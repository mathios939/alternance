import { createLogger } from "@/lib/logger";
import type {
  FetchPage,
  FetchParams,
  JobSourceProvider,
  ProviderCapabilities,
  ProviderStatus,
  VerificationResult,
} from "../../types";
import {
  FranceTravailApiError,
  FranceTravailClient,
  type FtClientConfig,
  type FtSearchParams,
} from "./client";
import { CommuneResolver } from "./communes";
import { ftOfferSchema, mapFtOffer } from "./mapper";

export { FranceTravailApiError, FranceTravailClient, CommuneResolver, ftOfferSchema, mapFtOffer };
export * from "./mapper";

const log = createLogger("job-sources:france-travail");

/** Codes « nature de contrat » alternance par défaut ; confirmés à chaud via le référentiel de l'API. */
export const DEFAULT_ALTERNANCE_NATURE_CODES = ["E2", "FS"];

export type FranceTravailProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  /** Surcharge des codes nature de contrat (ex. « E2,FS »). */
  natureContratCodes?: string[];
  /** Résultats max par appel `fetchJobs` (borne API : 3 150). */
  maxResults?: number;
  client?: Partial<Omit<FtClientConfig, "clientId" | "clientSecret">>;
};

/**
 * Source officielle France Travail (ex Pôle emploi) — API « Offres d'emploi v2 ».
 * Nécessite un compte partenaire sur https://francetravail.io (client id / secret).
 * Sans identifiants : statut « non configuré » avec la liste exacte des variables manquantes.
 * Jamais de bascule silencieuse vers des données simulées.
 */
export class FranceTravailProvider implements JobSourceProvider {
  readonly key = "france-travail";
  readonly name = "France Travail";
  readonly type = "FRANCE_TRAVAIL" as const;
  readonly priority = 70;
  readonly capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsIncrementalSync: true,
    supportsLocation: true,
    supportsRadius: true,
    supportsDetails: true,
    supportsSalary: true,
    supportsExpiration: false,
    supportsVerification: true,
  };

  private clientInstance: FranceTravailClient | null = null;
  private resolver: CommuneResolver | null = null;
  private natureCodes: Promise<string[]> | null = null;

  constructor(private readonly config: FranceTravailProviderConfig = {}) {}

  /** Variables d'environnement manquantes (liste explicite, jamais de repli implicite). */
  missingEnv(): string[] {
    const missing: string[] = [];
    if (!this.config.clientId) missing.push("FRANCE_TRAVAIL_CLIENT_ID");
    if (!this.config.clientSecret) missing.push("FRANCE_TRAVAIL_CLIENT_SECRET");
    return missing;
  }

  async status(): Promise<ProviderStatus> {
    const missing = this.missingEnv();
    return {
      key: this.key,
      name: this.name,
      type: this.type,
      configured: missing.length === 0,
      missing,
      reason: missing.length
        ? `Variables manquantes : ${missing.join(", ")} (compte partenaire sur https://francetravail.io)`
        : undefined,
    };
  }

  /** Client HTTP (instancié à la demande). Lève une erreur claire si non configuré. */
  client(): FranceTravailClient {
    if (this.clientInstance) return this.clientInstance;
    const missing = this.missingEnv();
    if (missing.length)
      throw new FranceTravailApiError(
        `Provider France Travail non configuré : ${missing.join(", ")}`,
        "AUTH",
      );
    this.clientInstance = new FranceTravailClient({
      clientId: this.config.clientId!,
      clientSecret: this.config.clientSecret!,
      ...this.config.client,
    });
    this.resolver = new CommuneResolver(this.clientInstance);
    return this.clientInstance;
  }

  communes(): CommuneResolver {
    this.client();
    return this.resolver!;
  }

  /**
   * Codes nature de contrat correspondant à l'alternance, lus dans le référentiel officiel
   * (libellés contenant « apprentissage » ou « professionnalisation »). Repli : E2, FS.
   */
  async alternanceNatureCodes(): Promise<string[]> {
    if (this.config.natureContratCodes?.length) return this.config.natureContratCodes;
    if (!this.natureCodes) {
      this.natureCodes = this.client()
        .getReferentiel("naturesContrats")
        .then((rows) => {
          const codes = (rows as Array<{ code?: string; libelle?: string }>)
            .filter((r) => r.code && /apprentissage|professionnalisation/i.test(r.libelle ?? ""))
            .map((r) => r.code!);
          if (codes.length === 0) {
            log.warn(
              "Référentiel naturesContrats sans code alternance identifiable, repli sur E2,FS",
            );
            return DEFAULT_ALTERNANCE_NATURE_CODES;
          }
          log.info("Codes alternance confirmés par le référentiel", { codes });
          return codes;
        })
        .catch((error) => {
          log.warn("Référentiel naturesContrats indisponible, repli sur E2,FS", {
            error: String(error),
          });
          this.natureCodes = null;
          return DEFAULT_ALTERNANCE_NATURE_CODES;
        });
    }
    return this.natureCodes;
  }

  async contractNatures(): Promise<string[]> {
    return this.alternanceNatureCodes();
  }

  /** Construit les paramètres de recherche à partir des paramètres génériques. */
  async buildSearchParams(
    params: FetchParams,
  ): Promise<{ search: Omit<FtSearchParams, "range">; warnings: string[] }> {
    const warnings: string[] = [];
    const natures = params.contractNatures?.length
      ? params.contractNatures
      : await this.alternanceNatureCodes();
    const search: Omit<FtSearchParams, "range"> = {
      natureContrat: natures.join(","),
      sort: 1,
      priority: params.priority ?? "backfill",
    };
    if (params.keywords?.trim()) search.motsCles = params.keywords.trim().slice(0, 200);
    const cityInput = params.inseeCode ?? params.city;
    if (cityInput) {
      const commune = await this.communes().resolve(cityInput);
      if (commune) {
        search.commune = commune.inseeCode;
        search.distance = Math.max(0, Math.min(params.radiusKm ?? 10, 200));
      } else {
        warnings.push(
          `Commune « ${cityInput} » introuvable dans le référentiel France Travail : recherche sans rayon.`,
        );
      }
    }
    if (!search.commune && params.department) search.departement = params.department;
    if (!search.commune && !search.departement && params.region) search.region = params.region;
    if (params.since) {
      // L'API exige les deux bornes ensemble : fenêtre explicite [since, until].
      search.minCreationDate = params.since;
      search.maxCreationDate = params.until ?? new Date();
    } else if (params.publishedWithinDays) {
      const allowed = [1, 3, 7, 14, 31] as const;
      search.publieeDepuis = allowed.find((d) => d >= params.publishedWithinDays!) ?? 31;
    }
    return { search, warnings };
  }

  async fetchJobs(params: FetchParams): Promise<FetchPage> {
    const status = await this.status();
    if (!status.configured)
      throw new FranceTravailApiError(status.reason ?? "Provider non configuré", "AUTH");
    const client = this.client();
    const { search, warnings } = await this.buildSearchParams(params);
    const started = Date.now();
    const result = await client.searchAll(search, {
      maxResults: Math.min(params.limit ?? this.config.maxResults ?? 1150, 3150),
      stopIfTruncated: params.stopIfTruncated,
    });
    warnings.push(...result.warnings);
    const jobs = [];
    let invalid = 0;
    for (const raw of result.offers) {
      const parsed = ftOfferSchema.safeParse(raw);
      if (!parsed.success) {
        invalid++;
        continue;
      }
      jobs.push(mapFtOffer(parsed.data));
    }
    if (invalid) warnings.push(`${invalid} offre(s) au format inattendu ignorée(s).`);
    log.info("Recherche terminée", {
      provider: this.key,
      operation: "search",
      durationMs: Date.now() - started,
      status: "ok",
      count: jobs.length,
      total: result.total,
      requests: result.requests,
      truncated: result.truncated,
    });
    return {
      jobs,
      total: result.total,
      requests: result.requests,
      warnings,
      truncated: result.truncated,
    };
  }

  /** Vérifie l'existence d'offres via l'endpoint de détail (retrait = 404 / 204). */
  async verifyJobs(externalIds: string[]): Promise<VerificationResult[]> {
    const client = this.client();
    const results: VerificationResult[] = [];
    for (const externalId of externalIds) {
      try {
        const detail = await client.getOffer(externalId, "verify");
        if (detail === null) {
          results.push({ externalId, status: "REMOVED", job: null });
          continue;
        }
        const parsed = ftOfferSchema.safeParse(detail);
        results.push(
          parsed.success
            ? { externalId, status: "ACTIVE", job: mapFtOffer(parsed.data) }
            : { externalId, status: "UNKNOWN", error: "Format inattendu" },
        );
      } catch (error) {
        results.push({
          externalId,
          status: "UNKNOWN",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}

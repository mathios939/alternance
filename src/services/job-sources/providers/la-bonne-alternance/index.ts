import { findCity } from "@/config/cities";
import {
  departmentCodeFromPostal,
  departmentCodesOfRegion,
  findDepartmentByCode,
} from "@/config/departments";
import { createLogger } from "@/lib/logger";
import type {
  FetchPage,
  FetchParams,
  JobSourceProvider,
  ProviderCapabilities,
  ProviderStatus,
  RawJob,
} from "../../types";
import {
  LA_BONNE_ALTERNANCE_DEFAULTS,
  LaBonneAlternanceApiError,
  LaBonneAlternanceClient,
  lbaQuotaManager,
  type LbaClientConfig,
} from "./client";
import {
  FRANCE_TRAVAIL_PARTNER_LABEL,
  isFranceTravailRelay,
  isInactiveStatus,
  lbaOfferSchema,
  mapLbaOffer,
  parseAddress,
} from "./mapper";

export {
  LA_BONNE_ALTERNANCE_DEFAULTS,
  LaBonneAlternanceApiError,
  LaBonneAlternanceClient,
  lbaQuotaManager,
  lbaOfferSchema,
  mapLbaOffer,
};
export * from "./mapper";

const log = createLogger("job-sources:la-bonne-alternance");

export const LBA_PORTAL_URL = "https://api.apprentissage.beta.gouv.fr/compte/profil";
export const LBA_CGU_URL = "https://api.apprentissage.beta.gouv.fr/cgu";
export const LBA_SUPPORT_EMAIL = "support_api@apprentissage.beta.gouv.fr";

export type LaBonneAlternanceProviderConfig = {
  apiKey?: string;
  /** Type de clé déclaré : « production » (offres réelles) ou « sandbox » (données de test → ingestion refusée). */
  keyType?: string;
  /**
   * Mode national : « export » (catalogue complet publié chaque jour, découpé par département — défaut)
   * ou « search » (recherche par département, 150 offres max par source : jamais exhaustive).
   */
  nationalMode?: "export" | "search";
  /** Durée de validité du catalogue exporté en mémoire (défaut 6 h ; la source le met à jour une fois par jour). */
  exportTtlMs?: number;
  client?: Partial<Omit<LbaClientConfig, "apiKey">>;
};

type ExportCatalogue = {
  loadedAt: number;
  lastUpdate: string;
  total: number;
  byDepartment: Map<string, unknown[]>;
  withoutDepartment: unknown[];
};

const DEFAULT_EXPORT_TTL_MS = 6 * 3_600_000;

/** Code département d'une offre brute de l'export (lecture défensive, sans validation complète). */
function rawDepartmentCode(raw: unknown): string | null {
  const address = (raw as { workplace?: { location?: { address?: unknown } } } | null)?.workplace
    ?.location?.address;
  return typeof address === "string"
    ? departmentCodeFromPostal(parseAddress(address).postalCode)
    : null;
}

/**
 * Deuxième source réelle et légale : API Alternance du Ministère du Travail (« La bonne alternance »),
 * licence Etalab-2.0, clé d'API gratuite (https://api.apprentissage.beta.gouv.fr/compte/profil).
 *
 * Périmètre : offres collectées par La bonne alternance et offres publiées par ses partenaires. Les
 * offres que l'API relaie depuis France Travail sont IGNORÉES (déjà ingérées à la source, avec un
 * identifiant stable et une vérification d'existence) : l'apport mesuré est donc réellement unique.
 *
 * Couverture nationale : l'export complet quotidien (une requête + un téléchargement, mis en cache
 * en mémoire), découpé par département pour s'insérer dans la synchronisation nationale (points de
 * reprise, réconciliation des offres disparues). Recherche autour d'une ville : /job/v1/search
 * (150 offres max par source, signalé comme non exhaustif).
 *
 * Sans clé, ou avec une clé « sandbox » (données de test) : statut « non configuré » explicite,
 * jamais de bascule silencieuse.
 */
export class LaBonneAlternanceProvider implements JobSourceProvider {
  readonly key = "la-bonne-alternance";
  readonly name = "La bonne alternance";
  readonly type = "PARTNER" as const;
  /** Sous France Travail (70) : source partenaire / agrégateur officiel ; au-dessus de la saisie manuelle (50). */
  readonly priority = 60;
  readonly capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsIncrementalSync: false,
    supportsLocation: true,
    supportsRadius: true,
    supportsDetails: false,
    supportsSalary: false,
    supportsExpiration: true,
    supportsVerification: false,
  };

  private clientInstance: LaBonneAlternanceClient | null = null;
  private catalogue: ExportCatalogue | null = null;
  private cataloguePromise: Promise<ExportCatalogue> | null = null;

  constructor(private readonly config: LaBonneAlternanceProviderConfig = {}) {}

  /** Variables d'environnement manquantes (liste explicite, jamais de repli implicite). */
  missingEnv(): string[] {
    const missing: string[] = [];
    if (!this.config.apiKey) missing.push("LA_BONNE_ALTERNANCE_API_KEY");
    if ((this.config.keyType ?? "").trim().toLowerCase() !== "production")
      missing.push("LA_BONNE_ALTERNANCE_KEY_TYPE");
    return missing;
  }

  async status(): Promise<ProviderStatus> {
    const missing = this.missingEnv();
    let reason: string | undefined;
    if (!this.config.apiKey)
      reason = `Variables manquantes : ${missing.join(", ")} (clé d'API gratuite sur ${LBA_PORTAL_URL}, licence Etalab-2.0, CGU ${LBA_CGU_URL} ; les offres réelles exigent une clé de type « production », à demander à ${LBA_SUPPORT_EMAIL}, puis LA_BONNE_ALTERNANCE_KEY_TYPE=production)`;
    else if ((this.config.keyType ?? "").trim().toLowerCase() === "sandbox")
      reason = `Clé de type sandbox : l'API renvoie des données de test, l'ingestion est désactivée (clé de production à demander à ${LBA_SUPPORT_EMAIL}, puis LA_BONNE_ALTERNANCE_KEY_TYPE=production)`;
    else if (missing.length)
      reason = `Variable manquante : LA_BONNE_ALTERNANCE_KEY_TYPE (« production » une fois la clé de production obtenue, « sandbox » sinon)`;
    return {
      key: this.key,
      name: this.name,
      type: this.type,
      configured: missing.length === 0,
      missing,
      reason,
    };
  }

  /** Client HTTP (instancié à la demande). Lève une erreur claire sans clé. Utilisable avec une clé sandbox pour les tests réseau. */
  client(): LaBonneAlternanceClient {
    if (this.clientInstance) return this.clientInstance;
    if (!this.config.apiKey)
      throw new LaBonneAlternanceApiError(
        "Provider La bonne alternance non configuré : LA_BONNE_ALTERNANCE_API_KEY",
        "AUTH",
      );
    this.clientInstance = new LaBonneAlternanceClient({
      apiKey: this.config.apiKey,
      ...this.config.client,
    });
    return this.clientInstance;
  }

  /** Catalogue complet (export quotidien), chargé une fois par processus et indexé par département. */
  async loadCatalogue(priority: FetchParams["priority"] = "backfill"): Promise<ExportCatalogue> {
    const ttl = this.config.exportTtlMs ?? DEFAULT_EXPORT_TTL_MS;
    if (this.catalogue && Date.now() - this.catalogue.loadedAt < ttl) return this.catalogue;
    if (!this.cataloguePromise) {
      this.cataloguePromise = (async () => {
        const client = this.client();
        const started = Date.now();
        const info = await client.exportInfo(priority);
        const offers = await client.downloadExport(info.url);
        const byDepartment = new Map<string, unknown[]>();
        const withoutDepartment: unknown[] = [];
        for (const raw of offers) {
          const code = rawDepartmentCode(raw);
          if (!code) {
            withoutDepartment.push(raw);
            continue;
          }
          const bucket = byDepartment.get(code);
          if (bucket) bucket.push(raw);
          else byDepartment.set(code, [raw]);
        }
        const catalogue: ExportCatalogue = {
          loadedAt: Date.now(),
          lastUpdate: info.lastUpdate,
          total: offers.length,
          byDepartment,
          withoutDepartment,
        };
        this.catalogue = catalogue;
        log.info("Catalogue chargé", {
          provider: this.key,
          operation: "export",
          count: offers.length,
          departments: byDepartment.size,
          withoutDepartment: withoutDepartment.length,
          lastUpdate: info.lastUpdate,
          durationMs: Date.now() - started,
        });
        return catalogue;
      })().finally(() => {
        this.cataloguePromise = null;
      });
    }
    return this.cataloguePromise;
  }

  /** Offres brutes de l'export pour un département, une région ou la France entière. */
  private async exportSlice(
    params: FetchParams,
    priority: FetchParams["priority"],
  ): Promise<{ raws: unknown[]; lastUpdate: string }> {
    const catalogue = await this.loadCatalogue(priority);
    if (params.department) {
      const dep = findDepartmentByCode(params.department);
      const code = dep?.code ?? params.department;
      return { raws: catalogue.byDepartment.get(code) ?? [], lastUpdate: catalogue.lastUpdate };
    }
    if (params.region) {
      const codes = departmentCodesOfRegion(params.region);
      return {
        raws: codes.flatMap((c) => catalogue.byDepartment.get(c) ?? []),
        lastUpdate: catalogue.lastUpdate,
      };
    }
    return {
      raws: [...catalogue.byDepartment.values()].flat().concat(catalogue.withoutDepartment),
      lastUpdate: catalogue.lastUpdate,
    };
  }

  async fetchJobs(params: FetchParams): Promise<FetchPage> {
    const status = await this.status();
    if (!status.configured)
      throw new LaBonneAlternanceApiError(status.reason ?? "Provider non configuré", "AUTH");
    const client = this.client();
    const priority = params.priority ?? "backfill";
    const before = client.requestCount;
    const started = Date.now();
    const warnings: string[] = [];
    let raws: unknown[];
    let exhaustive: boolean;

    const city = params.city ? findCity(params.city) : null;
    if (params.city && !city && !params.department && !params.region)
      warnings.push(
        `Ville « ${params.city} » inconnue de la configuration : recherche sur la France entière (export).`,
      );
    if (city) {
      // Recherche géographique : 150 offres max par source, jamais exhaustive.
      const res = await client.search({
        latitude: city.lat,
        longitude: city.lng,
        radius: Math.max(0, Math.min(params.radiusKm ?? 30, 200)),
        partnersToExclude: [FRANCE_TRAVAIL_PARTNER_LABEL],
        priority,
      });
      raws = res.jobs;
      exhaustive = false;
      warnings.push(...res.warnings.map((w) => `${w.code} : ${w.message}`));
    } else if ((this.config.nationalMode ?? "export") === "search" && params.department) {
      const res = await client.search({
        departements: [params.department],
        partnersToExclude: [FRANCE_TRAVAIL_PARTNER_LABEL],
        priority,
      });
      raws = res.jobs;
      exhaustive = false;
      warnings.push(...res.warnings.map((w) => `${w.code} : ${w.message}`));
    } else {
      const slice = await this.exportSlice(params, priority);
      raws = slice.raws;
      exhaustive = true;
    }

    const jobs: RawJob[] = [];
    const seen = new Set<string>();
    let relayed = 0;
    let inactive = 0;
    let invalid = 0;
    let repeated = 0;
    let collected = 0;
    let partners = 0;
    for (const raw of raws) {
      const parsed = lbaOfferSchema.safeParse(raw);
      if (!parsed.success) {
        invalid++;
        continue;
      }
      const o = parsed.data;
      if (isFranceTravailRelay(o)) {
        relayed++;
        continue;
      }
      if (isInactiveStatus(o)) {
        inactive++;
        continue;
      }
      const job = mapLbaOffer(o);
      if (!job.externalId) {
        invalid++;
        continue;
      }
      if (seen.has(job.externalId)) {
        repeated++;
        continue;
      }
      seen.add(job.externalId);
      if ((o.identifier?.partner_label ?? "") === "offres_emploi_lba") collected++;
      else partners++;
      jobs.push(job);
    }
    if (relayed)
      warnings.push(
        `${relayed} offre(s) relayée(s) de France Travail ignorée(s) : déjà ingérées à la source.`,
      );
    if (inactive) warnings.push(`${inactive} offre(s) pourvue(s) ou annulée(s) ignorée(s).`);
    if (invalid) warnings.push(`${invalid} offre(s) au format inattendu ignorée(s).`);
    if (repeated) warnings.push(`${repeated} identifiant(s) répété(s) dans la réponse ignoré(s).`);
    const cap = LA_BONNE_ALTERNANCE_DEFAULTS.maxPerSource;
    const truncated = !exhaustive && (collected >= cap || partners >= cap);
    if (truncated)
      warnings.push(
        `Recherche bornée à ${cap} offres par source par l'API : résultats non exhaustifs (la couverture nationale passe par l'export complet).`,
      );

    log.info("Récupération terminée", {
      provider: this.key,
      operation: exhaustive ? "export" : "search",
      durationMs: Date.now() - started,
      status: "ok",
      count: jobs.length,
      collected,
      partners,
      relayed,
      requests: client.requestCount - before,
      truncated,
    });
    return {
      jobs,
      total: exhaustive ? jobs.length : null,
      requests: client.requestCount - before,
      warnings,
      truncated,
    };
  }
}

import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { EMPLOYEE_RANGES } from "../naf";
import type { CompanyDataProvider, CompanyProviderCapabilities, CompanyProviderStatus, CompanyRecord, CompanySearchPage, CompanySearchParams } from "../types";

/**
 * API « Recherche d'entreprises » (https://recherche-entreprises.api.gouv.fr) — open data officiel
 * (SIRENE, RNE, …), sans clé, licence ouverte. Limite documentée : 7 requêtes/seconde.
 * Chaque fiche renvoie vers l'Annuaire des entreprises (source publique vérifiable).
 */
const log = createLogger("company-data:recherche-entreprises");

export const RECHERCHE_ENTREPRISES_DEFAULTS = {
  baseUrl: "https://recherche-entreprises.api.gouv.fr",
  timeoutMs: 15_000,
  minIntervalMs: 200,
  maxRetries: 2,
  perPage: 25,
} as const;

export class CompanyApiError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "RATE_LIMITED" | "SERVER" | "TIMEOUT" | "NETWORK" | "PARSE" | "NOT_FOUND",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CompanyApiError";
  }
}

const str = z.string().nullish();
const num = z.number().nullish();
const numStr = z.union([z.number(), z.string()]).nullish();

const siegeSchema = z.looseObject({
  siret: str,
  adresse: str,
  numero_voie: str,
  type_voie: str,
  libelle_voie: str,
  code_postal: str,
  libelle_commune: str,
  commune: str,
  departement: str,
  region: str,
  latitude: numStr,
  longitude: numStr,
  activite_principale: str,
  tranche_effectif_salarie: str,
  date_creation: str,
  etat_administratif: str,
});

export const rechercheEntrepriseSchema = z.looseObject({
  siren: z.string(),
  nom_complet: str,
  nom_raison_sociale: str,
  sigle: str,
  nombre_etablissements: num,
  nombre_etablissements_ouverts: num,
  siege: siegeSchema.nullish(),
  activite_principale: str,
  categorie_entreprise: str,
  date_creation: str,
  etat_administratif: str,
  nature_juridique: str,
  tranche_effectif_salarie: str,
  annee_tranche_effectif_salarie: str,
  complements: z.looseObject({ est_association: z.boolean().nullish(), est_ess: z.boolean().nullish(), est_entrepreneur_individuel: z.boolean().nullish() }).nullish(),
});

export type RechercheEntreprise = z.infer<typeof rechercheEntrepriseSchema>;

const responseSchema = z.looseObject({ results: z.array(z.unknown()), total_results: num, page: num, per_page: num, total_pages: num });

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** « NANTES » → « Nantes » ; garde les traits d'union et apostrophes. */
function titleCase(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((p) => (/^[\s\-']$/.test(p) || !p ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("")
    .replace(/\b(Sur|Sous|Les|Le|La|De|Du|Des|En|Et|Aux|Au)\b/g, (m, _w, offset: number) => (offset === 0 ? m : m.toLowerCase()));
}

export function mapRechercheEntreprise(r: RechercheEntreprise): CompanyRecord {
  const siege = r.siege ?? null;
  const range = r.tranche_effectif_salarie ?? siege?.tranche_effectif_salarie ?? null;
  const rangeInfo = range ? EMPLOYEE_RANGES[range] : undefined;
  const legalName = (r.nom_raison_sociale ?? r.nom_complet ?? "").trim();
  const brand = r.sigle?.trim() || null;
  return {
    siren: r.siren,
    siret: siege?.siret ?? null,
    legalName: legalName || r.siren,
    brandName: brand && brand !== legalName ? brand : null,
    nafCode: r.activite_principale ?? siege?.activite_principale ?? null,
    nafLabel: null,
    legalCategory: r.nature_juridique ?? null,
    employeeRange: range && range !== "NN" ? range : null,
    employeeRangeLabel: rangeInfo && range !== "NN" ? rangeInfo.label : null,
    headcountEstimate: rangeInfo && range !== "NN" ? rangeInfo.min : null,
    address: siege?.adresse ?? [siege?.numero_voie, siege?.type_voie, siege?.libelle_voie].filter(Boolean).join(" ") ?? null,
    city: titleCase(siege?.libelle_commune),
    postalCode: siege?.code_postal ?? null,
    inseeCode: siege?.commune ?? null,
    departmentCode: siege?.departement ?? null,
    latitude: toNumber(siege?.latitude),
    longitude: toNumber(siege?.longitude),
    registeredAt: r.date_creation ? new Date(r.date_creation) : null,
    isActive: (r.etat_administratif ?? "A") === "A",
    category: r.categorie_entreprise ?? null,
    website: null,
    sourceUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`,
    raw: r,
  };
}

export class RechercheEntreprisesProvider implements CompanyDataProvider {
  readonly key = "recherche-entreprises";
  readonly name = "Annuaire des entreprises (API Recherche d'entreprises, SIRENE)";
  readonly capabilities: CompanyProviderCapabilities = {
    supportsTextSearch: true,
    supportsNafFilter: true,
    supportsGeoFilter: true,
    supportsSirenLookup: true,
    providesCoordinates: true,
    providesHeadcount: true,
    providesWebsite: false,
  };
  private lastRequestAt = 0;
  requestCount = 0;

  constructor(private readonly options: { baseUrl?: string; timeoutMs?: number; minIntervalMs?: number; maxRetries?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; enabled?: boolean } = {}) {}

  async status(): Promise<CompanyProviderStatus> {
    const enabled = this.options.enabled ?? process.env["COMPANY_DATA_PROVIDER"] !== "none";
    return { key: this.key, name: this.name, configured: enabled, reason: enabled ? undefined : "Désactivé par COMPANY_DATA_PROVIDER=none" };
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined>, attempt = 0): Promise<T> {
    const base = (this.options.baseUrl ?? RECHERCHE_ENTREPRISES_DEFAULTS.baseUrl).replace(/\/$/, "");
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const wait = this.lastRequestAt + (this.options.minIntervalMs ?? RECHERCHE_ENTREPRISES_DEFAULTS.minIntervalMs) - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
    this.requestCount++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? RECHERCHE_ENTREPRISES_DEFAULTS.timeoutMs);
    const maxRetries = this.options.maxRetries ?? RECHERCHE_ENTREPRISES_DEFAULTS.maxRetries;
    let res: Response;
    try {
      res = await (this.options.fetchImpl ?? fetch)(url.toString(), { headers: { accept: "application/json" }, signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      const code = (error as Error)?.name === "AbortError" ? "TIMEOUT" : "NETWORK";
      if (attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        return this.request<T>(path, params, attempt + 1);
      }
      throw new CompanyApiError(code === "TIMEOUT" ? "Délai dépassé (API Recherche d'entreprises)" : `Erreur réseau : ${(error as Error)?.message ?? String(error)}`, code);
    }
    clearTimeout(timer);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt);
        return this.request<T>(path, params, attempt + 1);
      }
      throw new CompanyApiError(res.status === 429 ? "Limite de débit dépassée (7 req/s)" : `Erreur serveur (${res.status})`, res.status === 429 ? "RATE_LIMITED" : "SERVER", res.status);
    }
    const text = await res.text();
    if (res.status === 404) throw new CompanyApiError("Introuvable", "NOT_FOUND", 404);
    if (res.status === 400) {
      let detail = text.slice(0, 200);
      try {
        detail = (JSON.parse(text) as { erreur?: string; message?: string }).erreur ?? (JSON.parse(text) as { message?: string }).message ?? detail;
      } catch {
        /* texte brut */
      }
      throw new CompanyApiError(`Requête invalide : ${detail}`, "BAD_REQUEST", 400);
    }
    if (!res.ok) throw new CompanyApiError(`Réponse inattendue (${res.status})`, "SERVER", res.status);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CompanyApiError("Réponse non JSON", "PARSE", res.status);
    }
  }

  async search(params: CompanySearchParams): Promise<CompanySearchPage> {
    const perPage = Math.min(params.perPage ?? RECHERCHE_ENTREPRISES_DEFAULTS.perPage, 25);
    const page = Math.max(1, params.page ?? 1);
    const started = Date.now();
    const body = await this.request<unknown>("/search", {
      q: params.text,
      activite_principale: params.nafCodes?.length ? params.nafCodes.join(",") : undefined,
      section_activite_principale: params.nafSection,
      departement: params.departmentCodes?.length ? params.departmentCodes.join(",") : undefined,
      region: params.regionCode,
      code_postal: params.postalCode,
      tranche_effectif_salarie: params.minEmployeeRange ? rangesFrom(params.minEmployeeRange).join(",") : undefined,
      etat_administratif: "A",
      page,
      per_page: perPage,
    });
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) throw new CompanyApiError("Format de réponse inattendu", "PARSE");
    const warnings: string[] = [];
    const results: CompanyRecord[] = [];
    for (const row of parsed.data.results) {
      const r = rechercheEntrepriseSchema.safeParse(row);
      if (!r.success) {
        warnings.push("Fiche au format inattendu ignorée");
        continue;
      }
      results.push(mapRechercheEntreprise(r.data));
    }
    log.debug("Recherche entreprises", { provider: this.key, operation: "search", durationMs: Date.now() - started, status: "ok", count: results.length, page });
    return { results, total: parsed.data.total_results ?? null, page, totalPages: parsed.data.total_pages ?? null, requests: 1, warnings };
  }

  async getBySiren(siren: string): Promise<CompanyRecord | null> {
    const clean = siren.replace(/\s/g, "");
    if (!/^\d{9}$/.test(clean)) return null;
    const page = await this.search({ text: clean, perPage: 1 });
    return page.results.find((r) => r.siren === clean) ?? null;
  }
}

/** Codes de tranche ≥ une tranche minimale (ordre INSEE). */
export function rangesFrom(minCode: string): string[] {
  const order = Object.keys(EMPLOYEE_RANGES).filter((k) => k !== "NN");
  const idx = order.indexOf(minCode);
  return idx < 0 ? order : order.slice(idx);
}

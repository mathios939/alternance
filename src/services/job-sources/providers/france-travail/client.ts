import { createLogger } from "@/lib/logger";

/**
 * Client HTTP pour l'API France Travail « Offres d'emploi v2 » (https://francetravail.io).
 *
 * Responsabilités : authentification OAuth2 client_credentials, renouvellement du jeton,
 * limitation de débit, pagination par `range`, gestion des 204/206/400/401/404/429/5xx,
 * timeouts et erreurs typées. Aucune donnée n'est inventée : la réponse brute est
 * transmise telle quelle au mapper.
 *
 * Les identifiants proviennent exclusivement des variables d'environnement
 * (FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET) et ne quittent jamais le serveur.
 */
const log = createLogger("france-travail:client");

export const FRANCE_TRAVAIL_DEFAULTS = {
  authUrl: "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
  baseUrl: "https://api.francetravail.io/partenaire/offresdemploi/v2",
  scope: "api_offresdemploiv2 o2dsoffre",
  timeoutMs: 15_000,
  /** ≈ 6 requêtes/s, sous la limite documentée de l'API (10 appels/s). */
  minIntervalMs: 160,
  maxRetries: 2,
  /** Taille maximale d'une page de résultats (`range` ≤ 150 éléments). */
  pageSize: 150,
  /** Borne haute absolue de l'API pour `range` (3 150 premiers résultats). */
  maxRangeEnd: 3149,
} as const;

export type FtErrorCode = "AUTH" | "RATE_LIMITED" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER" | "TIMEOUT" | "NETWORK" | "PARSE";

export class FranceTravailApiError extends Error {
  constructor(
    message: string,
    public readonly code: FtErrorCode,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "FranceTravailApiError";
  }
}

export type FtClientConfig = {
  clientId: string;
  clientSecret: string;
  authUrl?: string;
  baseUrl?: string;
  scope?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type FtSearchParams = {
  motsCles?: string;
  /** Code INSEE de la commune (pas le code postal). */
  commune?: string;
  /** Rayon en km autour de la commune (0 = commune exacte). */
  distance?: number;
  departement?: string;
  region?: string;
  /** Codes nature de contrat, séparés par des virgules (ex. E2 apprentissage). */
  natureContrat?: string;
  typeContrat?: string;
  publieeDepuis?: 1 | 3 | 7 | 14 | 31;
  minCreationDate?: Date;
  maxCreationDate?: Date;
  /** 0 = pertinence, 1 = date de création décroissante, 2 = distance. */
  sort?: 0 | 1 | 2;
  range?: { start: number; end: number };
  experienceExigence?: "D" | "S" | "E";
};

export type ContentRange = { start: number; end: number; total: number | null };

export type FtSearchResponse = {
  status: 200 | 206 | 204;
  resultats: unknown[];
  filtresPossibles: unknown;
  contentRange: ContentRange | null;
};

export type FtSearchAllResult = {
  offers: unknown[];
  total: number | null;
  requests: number;
  truncated: boolean;
  warnings: string[];
};

type TokenState = { value: string; expiresAt: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Formate une date au format attendu par l'API (ISO sans millisecondes, en UTC). */
export function formatFtDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function parseContentRange(header: string | null): ContentRange | null {
  if (!header) return null;
  const m = header.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+|\*)/);
  if (!m) return null;
  return { start: Number(m[1]), end: Number(m[2]), total: m[3] === "*" ? null : Number(m[3]) };
}

export class FranceTravailClient {
  private readonly cfg: Required<Omit<FtClientConfig, "fetchImpl" | "sleep" | "now">>;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private token: TokenState | null = null;
  private tokenPromise: Promise<string> | null = null;
  private lastRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();
  /** Compteur de requêtes HTTP (hors authentification), utile pour les rapports. */
  requestCount = 0;

  constructor(config: FtClientConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new FranceTravailApiError("Identifiants France Travail manquants (FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET)", "AUTH");
    }
    this.cfg = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authUrl: config.authUrl ?? FRANCE_TRAVAIL_DEFAULTS.authUrl,
      baseUrl: (config.baseUrl ?? FRANCE_TRAVAIL_DEFAULTS.baseUrl).replace(/\/$/, ""),
      scope: config.scope ?? FRANCE_TRAVAIL_DEFAULTS.scope,
      timeoutMs: config.timeoutMs ?? FRANCE_TRAVAIL_DEFAULTS.timeoutMs,
      minIntervalMs: config.minIntervalMs ?? FRANCE_TRAVAIL_DEFAULTS.minIntervalMs,
      maxRetries: config.maxRetries ?? FRANCE_TRAVAIL_DEFAULTS.maxRetries,
    };
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? defaultSleep;
    this.now = config.now ?? (() => Date.now());
  }

  // ── Authentification ────────────────────────────────────────

  /** Jeton d'accès valide (renouvelé automatiquement 60 s avant expiration). */
  async getAccessToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    if (!this.tokenPromise) {
      this.tokenPromise = this.requestToken().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  private async requestToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: this.cfg.scope,
    });
    const started = this.now();
    const res = await this.doFetch(this.cfg.authUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      const detail = safeJson(text) as { error?: string; error_description?: string } | null;
      const reason = detail?.error_description ?? detail?.error ?? text.slice(0, 200);
      log.warn("Authentification refusée", { status: res.status, durationMs: this.now() - started });
      throw new FranceTravailApiError(`Authentification France Travail refusée (${res.status}) : ${reason || "vérifie le client id / secret et les droits sur l'API Offres d'emploi v2"}`, "AUTH", res.status);
    }
    const data = safeJson(text) as { access_token?: string; expires_in?: number } | null;
    if (!data?.access_token) throw new FranceTravailApiError("Réponse d'authentification inattendue (pas d'access_token)", "PARSE", res.status);
    const ttl = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 1200;
    this.token = { value: data.access_token, expiresAt: this.now() + ttl * 1000 };
    log.info("Jeton obtenu", { operation: "auth", durationMs: this.now() - started, expiresInSec: ttl });
    return this.token.value;
  }

  // ── Requêtes ────────────────────────────────────────────────

  private async throttle(): Promise<void> {
    const run = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.cfg.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = this.now();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doFetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw new FranceTravailApiError(`Délai dépassé (${this.cfg.timeoutMs} ms) : ${url.split("?")[0]}`, "TIMEOUT");
      throw new FranceTravailApiError(`Erreur réseau : ${(error as Error)?.message ?? String(error)}`, "NETWORK");
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Requête authentifiée avec retries : 401 → nouveau jeton (une fois),
   * 429 → attente Retry-After, 5xx / timeout / réseau → backoff exponentiel.
   */
  async request<T>(path: string, params?: Record<string, string | number | undefined>, attempt = 0, refreshed = false): Promise<{ status: number; body: T | null; headers: Headers }> {
    const url = new URL(`${this.cfg.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const token = await this.getAccessToken();
    await this.throttle();
    const started = this.now();
    this.requestCount++;
    let res: Response;
    try {
      res = await this.doFetch(url.toString(), { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
    } catch (error) {
      if (error instanceof FranceTravailApiError && (error.code === "TIMEOUT" || error.code === "NETWORK") && attempt < this.cfg.maxRetries) {
        const wait = 500 * 2 ** attempt;
        log.warn("Requête échouée, nouvelle tentative", { operation: path, errorCode: error.code, attempt: attempt + 1, waitMs: wait });
        await this.sleep(wait);
        return this.request<T>(path, params, attempt + 1, refreshed);
      }
      throw error;
    }
    const durationMs = this.now() - started;

    if (res.status === 204) return { status: 204, body: null, headers: res.headers };
    if (res.status === 401 && !refreshed) {
      log.warn("Jeton refusé, renouvellement", { operation: path });
      await this.getAccessToken(true);
      return this.request<T>(path, params, attempt, true);
    }
    if (res.status === 429) {
      const retryAfterMs = parseRetryAfter(res.headers.get("retry-after")) ?? 1000 * 2 ** attempt;
      if (attempt < this.cfg.maxRetries) {
        log.warn("Limite de débit atteinte, attente", { operation: path, waitMs: retryAfterMs, attempt: attempt + 1 });
        await this.sleep(retryAfterMs);
        return this.request<T>(path, params, attempt + 1, refreshed);
      }
      throw new FranceTravailApiError("Limite de débit France Travail dépassée (429) après plusieurs tentatives", "RATE_LIMITED", 429, retryAfterMs);
    }
    if (res.status >= 500) {
      if (attempt < this.cfg.maxRetries) {
        const wait = 800 * 2 ** attempt;
        log.warn("Erreur serveur France Travail, nouvelle tentative", { operation: path, status: res.status, attempt: attempt + 1, waitMs: wait });
        await this.sleep(wait);
        return this.request<T>(path, params, attempt + 1, refreshed);
      }
      throw new FranceTravailApiError(`Erreur serveur France Travail (${res.status})`, "SERVER", res.status);
    }
    const text = await res.text();
    if (res.status === 400) {
      const detail = safeJson(text) as { message?: string; error?: string; description?: string } | null;
      throw new FranceTravailApiError(`Requête invalide (400) : ${detail?.message ?? detail?.description ?? detail?.error ?? text.slice(0, 200)}`, "BAD_REQUEST", 400);
    }
    if (res.status === 404 || res.status === 410) throw new FranceTravailApiError("Ressource introuvable (404)", "NOT_FOUND", res.status);
    if (res.status === 401 || res.status === 403) throw new FranceTravailApiError(`Accès refusé (${res.status}) : vérifie l'abonnement de l'application à l'API Offres d'emploi v2`, "AUTH", res.status);
    if (!res.ok) throw new FranceTravailApiError(`Réponse inattendue (${res.status})`, "SERVER", res.status);
    const body = text ? (safeJson(text) as T | null) : null;
    if (text && body === null) throw new FranceTravailApiError("Réponse non JSON", "PARSE", res.status);
    log.debug("Requête réussie", { operation: path, status: res.status, durationMs });
    return { status: res.status, body, headers: res.headers };
  }

  // ── API métier ──────────────────────────────────────────────

  /** Une page de résultats (`range` 150 max). 204 = aucun résultat. */
  async search(params: FtSearchParams): Promise<FtSearchResponse> {
    const range = params.range ?? { start: 0, end: FRANCE_TRAVAIL_DEFAULTS.pageSize - 1 };
    if (range.end - range.start + 1 > FRANCE_TRAVAIL_DEFAULTS.pageSize) throw new FranceTravailApiError("range : 150 résultats maximum par page", "BAD_REQUEST");
    if (range.end > FRANCE_TRAVAIL_DEFAULTS.maxRangeEnd) throw new FranceTravailApiError(`range : l'API n'expose que les ${FRANCE_TRAVAIL_DEFAULTS.maxRangeEnd + 1} premiers résultats`, "BAD_REQUEST");
    const query: Record<string, string | number | undefined> = {
      motsCles: params.motsCles,
      commune: params.commune,
      distance: params.distance,
      departement: params.departement,
      region: params.region,
      natureContrat: params.natureContrat,
      typeContrat: params.typeContrat,
      publieeDepuis: params.publieeDepuis,
      minCreationDate: params.minCreationDate ? formatFtDate(params.minCreationDate) : undefined,
      maxCreationDate: params.maxCreationDate ? formatFtDate(params.maxCreationDate) : undefined,
      experienceExigence: params.experienceExigence,
      sort: params.sort,
      range: `${range.start}-${range.end}`,
    };
    const res = await this.request<{ resultats?: unknown[]; filtresPossibles?: unknown }>("/offres/search", query);
    if (res.status === 204 || !res.body) return { status: 204, resultats: [], filtresPossibles: null, contentRange: null };
    return {
      status: res.status === 206 ? 206 : 200,
      resultats: Array.isArray(res.body.resultats) ? res.body.resultats : [],
      filtresPossibles: res.body.filtresPossibles ?? null,
      contentRange: parseContentRange(res.headers.get("content-range")),
    };
  }

  /** Toutes les pages jusqu'à `maxResults` (borné par l'API à 3 150). */
  async searchAll(params: Omit<FtSearchParams, "range">, options: { maxResults?: number; onPage?: (page: FtSearchResponse, fetched: number) => void } = {}): Promise<FtSearchAllResult> {
    const max = Math.min(options.maxResults ?? 1150, FRANCE_TRAVAIL_DEFAULTS.maxRangeEnd + 1);
    const offers: unknown[] = [];
    const warnings: string[] = [];
    let total: number | null = null;
    let start = 0;
    let requests = 0;
    while (start < max) {
      const end = Math.min(start + FRANCE_TRAVAIL_DEFAULTS.pageSize - 1, max - 1);
      const page = await this.search({ ...params, range: { start, end } });
      requests++;
      offers.push(...page.resultats);
      options.onPage?.(page, offers.length);
      if (page.contentRange?.total !== undefined && page.contentRange?.total !== null) total = page.contentRange.total;
      if (page.status === 204 || page.resultats.length === 0) break;
      // 200 = dernière page ; 206 = il en reste
      if (page.status === 200) break;
      if (total !== null && offers.length >= total) break;
      if (page.resultats.length < end - start + 1) break;
      start = end + 1;
    }
    const truncated = total !== null && offers.length < total;
    if (truncated) warnings.push(`Résultats tronqués : ${offers.length} récupérés sur ${total} annoncés (limite ${max}).`);
    return { offers, total: total ?? offers.length, requests, truncated, warnings };
  }

  /** Détail d'une offre. `null` si elle n'existe plus (offre retirée / expirée). */
  async getOffer(id: string): Promise<unknown | null> {
    try {
      const res = await this.request<unknown>(`/offres/${encodeURIComponent(id)}`);
      return res.status === 204 ? null : res.body;
    } catch (error) {
      if (error instanceof FranceTravailApiError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }

  /** Référentiels publics de l'API (communes, naturesContrats, regions, departements, …). */
  async getReferentiel(name: "communes" | "naturesContrats" | "regions" | "departements" | "typesContrats" | "niveauxFormations"): Promise<unknown[]> {
    const res = await this.request<unknown[]>(`/referentiel/${name}`);
    return Array.isArray(res.body) ? res.body : [];
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(250, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(250, date - Date.now()) : null;
}

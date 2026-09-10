import { createLogger } from "@/lib/logger";
import { getQuotaManager, type QuotaManager, type QuotaPriority } from "../../quota";

/**
 * Client HTTP pour l'API Alternance du Ministère du Travail (« La bonne alternance »),
 * https://api.apprentissage.beta.gouv.fr — documentation OpenAPI : /api/documentation/json.
 *
 * Ce que la documentation officielle déclare (vérifié par le workflow « Source discovery ») :
 *   • authentification : clé d'API dans `Authorization: Bearer …`, créée sur
 *     https://api.apprentissage.beta.gouv.fr/compte/profil ; une clé « sandbox » renvoie des données de
 *     TEST, une clé « production » (à demander à support_api@apprentissage.beta.gouv.fr) les vraies offres ;
 *   • licence : Etalab-2.0 (licence ouverte) ; conditions : https://api.apprentissage.beta.gouv.fr/cgu ;
 *   • GET /job/v1/search : 60 appels / min / consommateur, 150 offres max PAR SOURCE (La bonne
 *     alternance, France Travail, partenaires) — jamais exhaustif ;
 *   • GET /job/v1/export : 2 appels / min, URL signée valable 2 min vers l'export COMPLET (mis à jour
 *     chaque jour à 3 h, heure de Paris), même structure que la recherche ;
 *   • 419 (et 429) = trop de requêtes.
 *
 * Aucune donnée n'est inventée : la réponse brute est transmise telle quelle au mapper.
 * La clé provient exclusivement de l'environnement (LA_BONNE_ALTERNANCE_API_KEY) et ne quitte jamais le serveur.
 */
const log = createLogger("la-bonne-alternance:client");

export const LA_BONNE_ALTERNANCE_DEFAULTS = {
  baseUrl: "https://api.apprentissage.beta.gouv.fr/api",
  timeoutMs: 20_000,
  /** Téléchargement de l'export complet (fichier JSON volumineux). */
  exportTimeoutMs: 180_000,
  maxRetries: 2,
  /**
   * Quota : limite officielle 60 appels / min sur la recherche → 0,5 / s (30 / min) par sécurité,
   * une seule requête simultanée. L'export (2 / min) n'est appelé qu'une fois par synchronisation.
   */
  maxPerSecond: 0.5,
  maxConcurrency: 1,
  perMinuteLimit: 30,
  /** Borne de la recherche : 150 offres par source. */
  maxPerSource: 150,
} as const;

export type LbaErrorCode =
  | "AUTH"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "SERVER"
  | "TIMEOUT"
  | "NETWORK"
  | "PARSE";

export class LaBonneAlternanceApiError extends Error {
  constructor(
    message: string,
    public readonly code: LbaErrorCode,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LaBonneAlternanceApiError";
  }
}

export type LbaClientConfig = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  exportTimeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Quota manager partagé (défaut : celui du fournisseur « la-bonne-alternance ») ; `null` = désactivé (tests). */
  quota?: QuotaManager | null;
};

export type LbaSearchParams = {
  latitude?: number;
  longitude?: number;
  /** Rayon en km (0 – 200, défaut API : 30). */
  radius?: number;
  /** Codes département (« 44 », « 2A », « 974 »). */
  departements?: string[];
  romes?: string[];
  targetDiplomaLevel?: "3" | "4" | "5" | "6" | "7";
  /** Libellés de partenaires à exclure (ex. « France Travail », déjà ingéré à la source). */
  partnersToExclude?: string[];
  /** Priorité dans la file du quota manager (jamais envoyée à l'API). */
  priority?: QuotaPriority;
};

export type LbaSearchResponse = {
  jobs: unknown[];
  recruiters: unknown[];
  warnings: Array<{ code: string; message: string }>;
};

export type LbaExportInfo = { url: string; lastUpdate: string };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Quota manager du fournisseur, borné par les limites officielles (jamais relevé par l'environnement). */
export function lbaQuotaManager(): QuotaManager {
  return getQuotaManager("la-bonne-alternance", {
    maxPerSecond: LA_BONNE_ALTERNANCE_DEFAULTS.maxPerSecond,
    maxConcurrency: LA_BONNE_ALTERNANCE_DEFAULTS.maxConcurrency,
    perMinuteLimit: LA_BONNE_ALTERNANCE_DEFAULTS.perMinuteLimit,
  });
}

export class LaBonneAlternanceClient {
  private readonly cfg: Required<Omit<LbaClientConfig, "fetchImpl" | "sleep" | "now" | "quota">>;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  readonly quota: QuotaManager | null;
  /** Compteur de requêtes HTTP vers l'API (téléchargement de l'export compris), utile pour les rapports. */
  requestCount = 0;

  constructor(config: LbaClientConfig) {
    if (!config.apiKey)
      throw new LaBonneAlternanceApiError(
        "Clé d'API La bonne alternance manquante (LA_BONNE_ALTERNANCE_API_KEY)",
        "AUTH",
      );
    this.cfg = {
      apiKey: config.apiKey,
      baseUrl: (config.baseUrl ?? LA_BONNE_ALTERNANCE_DEFAULTS.baseUrl).replace(/\/$/, ""),
      timeoutMs: config.timeoutMs ?? LA_BONNE_ALTERNANCE_DEFAULTS.timeoutMs,
      exportTimeoutMs: config.exportTimeoutMs ?? LA_BONNE_ALTERNANCE_DEFAULTS.exportTimeoutMs,
      maxRetries: config.maxRetries ?? LA_BONNE_ALTERNANCE_DEFAULTS.maxRetries,
    };
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? defaultSleep;
    this.now = config.now ?? (() => Date.now());
    this.quota = config.quota === undefined ? lbaQuotaManager() : config.quota;
  }

  private async doFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if ((error as Error)?.name === "AbortError")
        throw new LaBonneAlternanceApiError(
          `Délai dépassé (${timeoutMs} ms) : ${url.split("?")[0]}`,
          "TIMEOUT",
        );
      throw new LaBonneAlternanceApiError(
        `Erreur réseau : ${(error as Error)?.message ?? String(error)}`,
        "NETWORK",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Requête authentifiée avec retries : 419 / 429 → pause globale (Retry-After) puis nouvelle tentative,
   * 5xx / timeout / réseau → backoff exponentiel. Chaque appel passe par le quota manager.
   */
  async request<T>(
    path: string,
    query?: URLSearchParams,
    priority: QuotaPriority = "backfill",
    attempt = 0,
  ): Promise<{ status: number; body: T | null; headers: Headers }> {
    const qs = query?.toString();
    const url = `${this.cfg.baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const release = this.quota ? await this.quota.acquire(priority) : () => undefined;
    let res: Response;
    let text = "";
    const started = this.now();
    try {
      this.requestCount++;
      try {
        res = await this.doFetch(
          url,
          { headers: { authorization: `Bearer ${this.cfg.apiKey}`, accept: "application/json" } },
          this.cfg.timeoutMs,
        );
      } catch (error) {
        const retryable =
          error instanceof LaBonneAlternanceApiError &&
          (error.code === "TIMEOUT" || error.code === "NETWORK");
        if (retryable && attempt < this.cfg.maxRetries) {
          const wait = 500 * 2 ** attempt;
          log.warn("Requête échouée, nouvelle tentative", {
            operation: path,
            errorCode: (error as LaBonneAlternanceApiError).code,
            attempt: attempt + 1,
            waitMs: wait,
          });
          release();
          await this.sleep(wait);
          return this.request<T>(path, query, priority, attempt + 1);
        }
        if (retryable) this.quota?.reportFailure();
        throw error;
      }
      if (res.status !== 419 && res.status !== 429 && res.status < 500) text = await res.text();
    } finally {
      release();
    }
    const durationMs = this.now() - started;

    if (res.status === 419 || res.status === 429) {
      const retryAfterMs = parseRetryAfter(res.headers.get("retry-after")) ?? 2000 * 2 ** attempt;
      const pauseMs = this.quota ? this.quota.penalize(retryAfterMs) : retryAfterMs;
      if (attempt < this.cfg.maxRetries) {
        log.warn("Limite de débit atteinte, attente", {
          operation: path,
          status: res.status,
          waitMs: pauseMs,
          attempt: attempt + 1,
        });
        await this.sleep(pauseMs);
        return this.request<T>(path, query, priority, attempt + 1);
      }
      this.quota?.reportFailure();
      throw new LaBonneAlternanceApiError(
        `Limite de débit La bonne alternance dépassée (${res.status}) après plusieurs tentatives`,
        "RATE_LIMITED",
        res.status,
        pauseMs,
      );
    }
    if (res.status >= 500) {
      if (attempt < this.cfg.maxRetries) {
        const wait = 800 * 2 ** attempt;
        log.warn("Erreur serveur La bonne alternance, nouvelle tentative", {
          operation: path,
          status: res.status,
          attempt: attempt + 1,
          waitMs: wait,
        });
        await this.sleep(wait);
        return this.request<T>(path, query, priority, attempt + 1);
      }
      this.quota?.reportFailure();
      throw new LaBonneAlternanceApiError(
        `Erreur serveur La bonne alternance (${res.status})`,
        "SERVER",
        res.status,
      );
    }
    if (res.status === 401 || res.status === 403)
      throw new LaBonneAlternanceApiError(
        `Clé d'API refusée (${res.status}) : vérifie LA_BONNE_ALTERNANCE_API_KEY (clé créée sur https://api.apprentissage.beta.gouv.fr/compte/profil ; les données réelles exigent une clé de type « production »)`,
        "AUTH",
        res.status,
      );
    if (res.status === 400) {
      const detail = safeJson(text) as { message?: string; error?: string } | null;
      throw new LaBonneAlternanceApiError(
        `Requête invalide (400) : ${detail?.message ?? detail?.error ?? text.slice(0, 200)}`,
        "BAD_REQUEST",
        400,
      );
    }
    if (res.status === 404 || res.status === 410)
      throw new LaBonneAlternanceApiError("Ressource introuvable (404)", "NOT_FOUND", res.status);
    if (!res.ok)
      throw new LaBonneAlternanceApiError(
        `Réponse inattendue (${res.status})`,
        "SERVER",
        res.status,
      );
    const body = text ? (safeJson(text) as T | null) : null;
    if (text && body === null)
      throw new LaBonneAlternanceApiError("Réponse non JSON", "PARSE", res.status);
    this.quota?.reportSuccess();
    log.debug("Requête réussie", { operation: path, status: res.status, durationMs });
    return { status: res.status, body, headers: res.headers };
  }

  /** Recherche d'offres (150 max par source, jamais exhaustive). */
  async search(params: LbaSearchParams): Promise<LbaSearchResponse> {
    const query = new URLSearchParams();
    if (params.latitude !== undefined && params.longitude !== undefined) {
      query.set("latitude", String(params.latitude));
      query.set("longitude", String(params.longitude));
      query.set("radius", String(Math.max(0, Math.min(params.radius ?? 30, 200))));
    }
    for (const d of params.departements ?? []) query.append("departements", d);
    if (params.romes?.length) query.set("romes", params.romes.join(","));
    if (params.targetDiplomaLevel) query.set("target_diploma_level", params.targetDiplomaLevel);
    for (const p of params.partnersToExclude ?? []) query.append("partners_to_exclude", p);
    const res = await this.request<Partial<LbaSearchResponse>>(
      "/job/v1/search",
      query,
      params.priority ?? "backfill",
    );
    const body = res.body ?? {};
    return {
      jobs: Array.isArray(body.jobs) ? body.jobs : [],
      recruiters: Array.isArray(body.recruiters) ? body.recruiters : [],
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
    };
  }

  /** Métadonnées de l'export complet (URL signée valable 2 minutes). */
  async exportInfo(priority: QuotaPriority = "backfill"): Promise<LbaExportInfo> {
    const res = await this.request<Partial<LbaExportInfo>>("/job/v1/export", undefined, priority);
    if (!res.body?.url)
      throw new LaBonneAlternanceApiError("Export sans URL de téléchargement", "PARSE", res.status);
    return { url: res.body.url, lastUpdate: res.body.lastUpdate ?? "" };
  }

  /**
   * Télécharge l'export complet. L'URL signée ne doit recevoir AUCUN en-tête d'authentification
   * (stockage objet) ; le téléchargement ne consomme pas le quota de l'API.
   */
  async downloadExport(url: string): Promise<unknown[]> {
    this.requestCount++;
    const started = this.now();
    const res = await this.doFetch(
      url,
      { headers: { accept: "application/json" } },
      this.cfg.exportTimeoutMs,
    );
    if (!res.ok)
      throw new LaBonneAlternanceApiError(
        `Téléchargement de l'export refusé (${res.status})`,
        res.status === 403 || res.status === 401 ? "AUTH" : "SERVER",
        res.status,
      );
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new LaBonneAlternanceApiError("Export non JSON", "PARSE", res.status);
    }
    const jobs = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { jobs?: unknown }).jobs)
        ? ((body as { jobs: unknown[] }).jobs ?? [])
        : null;
    if (!jobs)
      throw new LaBonneAlternanceApiError("Export au format inattendu", "PARSE", res.status);
    log.info("Export téléchargé", {
      operation: "export",
      count: jobs.length,
      durationMs: this.now() - started,
    });
    return jobs;
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

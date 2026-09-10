/**
 * ─────────────────────────────────────────────────────────────
 * QUOTA MANAGER (Phase 30) — point de passage unique des appels sortants vers une source.
 *
 * Deux niveaux, toujours sous la limite officielle :
 *   1. processus : seau à jetons (débit max), concurrence bornée, file d'attente par priorité
 *      (live > récent > vérification > rattrapage), pause globale sur 429 (Retry-After) avec
 *      backoff exponentiel et gigue ;
 *   2. partagé : compteur d'appels par fournisseur et par minute stocké en base — plusieurs
 *      processus (workers GitHub Actions, fonctions serverless) ne dépassent jamais ensemble la
 *      limite. Une requête « live » n'est acceptée que si la minute courante laisse de la marge :
 *      elle ne fait jamais attendre l'utilisateur.
 *
 * France Travail (API Offres d'emploi v2) : 10 appels/seconde par application. Les valeurs par
 * défaut restent volontairement en dessous (FRANCE_TRAVAIL_MAX_RPS = 3, concurrence 2).
 * ─────────────────────────────────────────────────────────────
 */
export type QuotaPriority = "live" | "recent" | "verify" | "backfill";

const PRIORITY_RANK: Record<QuotaPriority, number> = { live: 0, recent: 1, verify: 2, backfill: 3 };

/** Compteur partagé (base de données) : réservation atomique d'appels dans une minute donnée. */
export interface SharedQuotaStore {
  /** Réserve `n` appels dans la minute `bucket` et renvoie le total réservé après opération. */
  reserve(provider: string, bucket: Date, n: number): Promise<number>;
  /** Appels déjà réservés dans la minute `bucket` (0 si aucun). */
  usage(provider: string, bucket: Date): Promise<number>;
  /** Journalise un 429 ou une erreur de requête dans la minute (observabilité, jamais bloquant). */
  record?(provider: string, bucket: Date, kind: "rateLimited" | "errors"): Promise<void>;
}

export type QuotaManagerOptions = {
  /** Débit maximal soutenu (jetons par seconde). */
  maxPerSecond: number;
  /** Requêtes simultanées maximales. */
  maxConcurrency: number;
  /** Plafond partagé par minute (défaut : maxPerSecond × 60). */
  perMinuteLimit?: number;
  /** Part de la minute au-delà de laquelle une requête « live » est refusée (défaut 0,6). */
  liveShare?: number;
  shared?: SharedQuotaStore | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

type Waiter = { seq: number; priority: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function minuteBucket(ts: number): Date {
  return new Date(Math.floor(ts / 60_000) * 60_000);
}

export class QuotaManager {
  private tokens: number;
  private lastRefill: number;
  private inFlight = 0;
  private queue: Waiter[] = [];
  private seq = 0;
  private pausedUntil = 0;
  private penalties = 0;
  private readonly opts: Required<
    Pick<QuotaManagerOptions, "maxPerSecond" | "maxConcurrency" | "perMinuteLimit" | "liveShare">
  >;
  private readonly shared: SharedQuotaStore | null;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  /** Compteurs du processus (rapports, admin). */
  readonly counters = { acquired: 0, rateLimited: 0, refusedLive: 0, waitedMs: 0, errors: 0 };

  constructor(
    readonly provider: string,
    options: QuotaManagerOptions,
  ) {
    const maxPerSecond = Math.max(0.1, options.maxPerSecond);
    this.opts = {
      maxPerSecond,
      maxConcurrency: Math.max(1, Math.floor(options.maxConcurrency)),
      perMinuteLimit: options.perMinuteLimit ?? Math.floor(maxPerSecond * 60),
      liveShare: options.liveShare ?? 0.6,
    };
    this.shared = options.shared ?? null;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.tokens = this.capacity;
    this.lastRefill = this.now();
  }

  /** Capacité du seau : au moins un jeton, sinon un débit inférieur à 1/s ne pourrait jamais servir. */
  private get capacity(): number {
    return Math.max(1, this.opts.maxPerSecond);
  }

  private refill(): void {
    const now = this.now();
    const elapsed = Math.max(0, now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.opts.maxPerSecond);
    this.lastRefill = now;
  }

  private isHead(waiter: Waiter): boolean {
    const head = this.queue[0];
    return head !== undefined && head.seq === waiter.seq;
  }

  private enqueue(priority: QuotaPriority): Waiter {
    const waiter: Waiter = { seq: ++this.seq, priority: PRIORITY_RANK[priority] };
    this.queue.push(waiter);
    this.queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    return waiter;
  }

  private dequeue(waiter: Waiter): void {
    this.queue = this.queue.filter((w) => w.seq !== waiter.seq);
  }

  /**
   * Attend un créneau (jeton + concurrence + pause 429 + quota partagé) puis le réserve.
   * Renvoie la fonction à appeler une fois la requête terminée. Une requête « live » lève
   * QuotaExceededError au lieu d'attendre si le débit ou la minute partagée sont saturés.
   */
  async acquire(priority: QuotaPriority = "backfill"): Promise<() => void> {
    const started = this.now();
    const waiter = this.enqueue(priority);
    try {
      for (;;) {
        this.refill();
        const now = this.now();
        const pauseLeft = this.pausedUntil - now;
        const ready =
          this.isHead(waiter) &&
          this.tokens >= 1 &&
          this.inFlight < this.opts.maxConcurrency &&
          pauseLeft <= 0;
        if (ready) break;
        if (priority === "live") {
          this.counters.refusedLive++;
          const retry = Math.max(
            pauseLeft,
            this.tokens >= 1 ? 0 : ((1 - this.tokens) / this.opts.maxPerSecond) * 1000,
            250,
          );
          throw new QuotaExceededError(
            "Quota local saturé : rafraîchissement live différé",
            Math.ceil(retry),
          );
        }
        const tokenWait =
          this.tokens >= 1 ? 0 : ((1 - this.tokens) / this.opts.maxPerSecond) * 1000;
        const wait = Math.max(
          5,
          Math.min(1000, Math.max(tokenWait, pauseLeft, this.isHead(waiter) ? 0 : 20)),
        );
        await this.sleep(wait);
      }
      this.tokens -= 1;
      this.inFlight++;
      this.dequeue(waiter);
      if (this.shared) {
        try {
          await this.reserveShared(priority);
        } catch (error) {
          this.inFlight--;
          throw error;
        }
      }
      this.counters.acquired++;
      this.counters.waitedMs += Math.max(0, this.now() - started);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.inFlight = Math.max(0, this.inFlight - 1);
      };
    } catch (error) {
      this.dequeue(waiter);
      throw error;
    }
  }

  /** Réserve un appel dans la minute partagée ; attend la minute suivante si le plafond est atteint. */
  private async reserveShared(priority: QuotaPriority): Promise<void> {
    if (!this.shared) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ts = this.now();
      const bucket = minuteBucket(ts);
      if (priority === "live") {
        const used = await this.shared.usage(this.provider, bucket);
        if (used >= this.opts.perMinuteLimit * this.opts.liveShare) {
          this.counters.refusedLive++;
          throw new QuotaExceededError(
            "Quota partagé de la minute presque atteint : rafraîchissement live différé",
            bucket.getTime() + 60_000 - ts,
          );
        }
      }
      const total = await this.shared.reserve(this.provider, bucket, 1);
      if (total <= this.opts.perMinuteLimit) return;
      // Plafond partagé dépassé (autre worker) : attendre le début de la minute suivante, avec gigue.
      const wait = bucket.getTime() + 60_000 - this.now() + Math.floor(this.random() * 500);
      if (priority === "live")
        throw new QuotaExceededError("Quota partagé de la minute atteint", wait);
      this.counters.rateLimited++;
      await this.sleep(Math.max(50, wait));
    }
  }

  /** Signale un 429 : pause globale (Retry-After ou backoff exponentiel), gigue incluse. */
  penalize(retryAfterMs?: number | null): number {
    this.penalties = Math.min(this.penalties + 1, 6);
    const backoff = Math.min(60_000, 1000 * 2 ** (this.penalties - 1));
    const base = Math.max(retryAfterMs ?? 0, backoff);
    const jitter = Math.floor(this.random() * Math.min(1000, base * 0.25));
    const until = this.now() + base + jitter;
    this.pausedUntil = Math.max(this.pausedUntil, until);
    this.counters.rateLimited++;
    this.record("rateLimited");
    return this.pausedUntil - this.now();
  }

  /** Une requête a abouti : le backoff repart de zéro. */
  reportSuccess(): void {
    this.penalties = 0;
  }

  /** Une requête a échoué définitivement (5xx, réseau, délai après relances) : comptée, jamais bloquante. */
  reportFailure(): void {
    this.counters.errors++;
    this.record("errors");
  }

  private record(kind: "rateLimited" | "errors"): void {
    if (!this.shared?.record) return;
    void this.shared.record(this.provider, minuteBucket(this.now()), kind).catch(() => undefined);
  }

  stats() {
    this.refill();
    return {
      provider: this.provider,
      maxPerSecond: this.opts.maxPerSecond,
      maxConcurrency: this.opts.maxConcurrency,
      perMinuteLimit: this.opts.perMinuteLimit,
      inFlight: this.inFlight,
      queued: this.queue.length,
      tokens: Math.round(this.tokens * 100) / 100,
      pausedForMs: Math.max(0, this.pausedUntil - this.now()),
      penalties: this.penalties,
      ...this.counters,
    };
  }
}

const registry = globalThis as unknown as { __quotaManagers?: Map<string, QuotaManager> };
registry.__quotaManagers ??= new Map();

export function readQuotaEnv(env: Record<string, string | undefined> = process.env): {
  maxPerSecond: number;
  maxConcurrency: number;
} {
  const rps = Number(env["FRANCE_TRAVAIL_MAX_RPS"]);
  const conc = Number(env["FRANCE_TRAVAIL_MAX_CONCURRENCY"]);
  return {
    // Jamais au-dessus de 8/s (limite officielle : 10/s), jamais en dessous de 0,5/s.
    maxPerSecond: Number.isFinite(rps) && rps > 0 ? Math.min(8, Math.max(0.5, rps)) : 3,
    maxConcurrency: Number.isFinite(conc) && conc > 0 ? Math.min(4, Math.floor(conc)) : 2,
  };
}

/** Quota manager partagé par tout le processus pour un fournisseur (créé à la demande). */
export function getQuotaManager(
  provider: string,
  options?: Partial<QuotaManagerOptions>,
): QuotaManager {
  const store = registry.__quotaManagers!;
  let manager = store.get(provider);
  if (!manager) {
    manager = new QuotaManager(provider, { ...readQuotaEnv(), ...options });
    store.set(provider, manager);
  }
  return manager;
}

export function registerQuotaManager(manager: QuotaManager): void {
  registry.__quotaManagers!.set(manager.provider, manager);
}

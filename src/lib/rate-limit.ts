/**
 * Rate limiting en mémoire (fenêtre glissante).
 * Suffisant pour un déploiement mono-instance ; pour une infra distribuée,
 * remplacer par Upstash/Redis via la même interface.
 */
export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
}

type Bucket = { timestamps: number[] };

export function createMemoryRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  function sweep(now: number) {
    if (now - lastSweep < options.windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);
      if (bucket.timestamps.length === 0) buckets.delete(key);
    }
  }

  return {
    async check(key) {
      const now = Date.now();
      sweep(now);
      const bucket = buckets.get(key) ?? { timestamps: [] };
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);
      const allowed = bucket.timestamps.length < options.limit;
      if (allowed) bucket.timestamps.push(now);
      buckets.set(key, bucket);
      const oldest = bucket.timestamps[0] ?? now;
      return {
        allowed,
        remaining: Math.max(0, options.limit - bucket.timestamps.length),
        resetAt: oldest + options.windowMs,
      };
    },
  };
}

const globalLimiters = globalThis as unknown as { __rateLimiters?: Map<string, RateLimiter> };
globalLimiters.__rateLimiters ??= new Map();

/** Récupère (ou crée) un limiteur nommé, partagé entre requêtes. */
export function getRateLimiter(name: string, options: { limit: number; windowMs: number }): RateLimiter {
  const store = globalLimiters.__rateLimiters!;
  let limiter = store.get(name);
  if (!limiter) {
    limiter = createMemoryRateLimiter(options);
    store.set(name, limiter);
  }
  return limiter;
}

/** Lève RATE_LIMITED si la limite est dépassée. */
export async function assertRateLimit(name: string, key: string, options: { limit: number; windowMs: number }): Promise<void> {
  const result = await getRateLimiter(name, options).check(key);
  if (!result.allowed) throw new Error("RATE_LIMITED");
}

import { describe, expect, it } from "vitest";
import {
  minuteBucket,
  QuotaExceededError,
  QuotaManager,
  readQuotaEnv,
  type SharedQuotaStore,
} from "@/services/job-sources/quota";

/** Horloge simulée : `sleep` avance le temps immédiatement (aucune attente réelle). */
function fakeClock(start = 1_000_000) {
  let now = start;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    advance: (ms: number) => {
      now += ms;
    },
    sleeps,
  };
}

describe("QuotaManager", () => {
  it("limite le débit avec un seau à jetons (rafale puis attente)", async () => {
    const clock = fakeClock();
    const q = new QuotaManager("test", {
      maxPerSecond: 2,
      maxConcurrency: 4,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0,
    });
    const t0 = clock.now();
    (await q.acquire())();
    (await q.acquire())();
    expect(clock.now() - t0).toBe(0);
    (await q.acquire())();
    // Troisième appel : un jeton se régénère en 500 ms à 2/s.
    expect(clock.now() - t0).toBeGreaterThanOrEqual(500);
    expect(clock.now() - t0).toBeLessThan(700);
    expect(q.stats().acquired).toBe(3);
  });

  it("borne la concurrence et libère le créneau", async () => {
    const clock = fakeClock();
    const q = new QuotaManager("test", {
      maxPerSecond: 100,
      maxConcurrency: 1,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0,
    });
    const release = await q.acquire();
    expect(q.stats().inFlight).toBe(1);
    let second: (() => void) | null = null;
    const pending = q.acquire().then((r) => {
      second = r;
    });
    await Promise.resolve();
    expect(second).toBeNull();
    release();
    await pending;
    expect(second).not.toBeNull();
    expect(q.stats().inFlight).toBe(1);
  });

  it("sert les priorités hautes avant les basses", async () => {
    const clock = fakeClock();
    const q = new QuotaManager("test", {
      maxPerSecond: 1,
      maxConcurrency: 4,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0,
    });
    (await q.acquire("backfill"))(); // épuise le seau
    const order: string[] = [];
    const a = q.acquire("backfill").then((r) => {
      order.push("backfill");
      r();
    });
    const b = q.acquire("verify").then((r) => {
      order.push("verify");
      r();
    });
    await Promise.all([a, b]);
    expect(order).toEqual(["verify", "backfill"]);
  });

  it("refuse une requête live au lieu de la faire attendre", async () => {
    const clock = fakeClock();
    const q = new QuotaManager("test", {
      maxPerSecond: 1,
      maxConcurrency: 4,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0,
    });
    (await q.acquire("recent"))();
    await expect(q.acquire("live")).rejects.toBeInstanceOf(QuotaExceededError);
    expect(q.stats().refusedLive).toBe(1);
    clock.advance(1000);
    (await q.acquire("live"))();
  });

  it("marque une pause globale après un 429 (Retry-After, backoff exponentiel, gigue) puis repart", async () => {
    const clock = fakeClock();
    const q = new QuotaManager("test", {
      maxPerSecond: 10,
      maxConcurrency: 4,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0.5,
    });
    const pause = q.penalize(3000);
    expect(pause).toBeGreaterThanOrEqual(3000);
    expect(pause).toBeLessThanOrEqual(3000 + 750);
    const t0 = clock.now();
    (await q.acquire())();
    expect(clock.now() - t0).toBeGreaterThanOrEqual(3000);
    // Sans Retry-After, la pénalité suit un backoff exponentiel plafonné.
    expect(q.penalize()).toBeGreaterThanOrEqual(2000);
    q.reportSuccess();
    expect(q.stats().penalties).toBe(0);
  });

  it("respecte le plafond partagé par minute entre processus", async () => {
    const clock = fakeClock(60_000 * 100);
    const counts = new Map<string, number>();
    const store: SharedQuotaStore = {
      async reserve(provider, bucket, n) {
        const k = `${provider}|${bucket.getTime()}`;
        counts.set(k, (counts.get(k) ?? 0) + n);
        return counts.get(k)!;
      },
      async usage(provider, bucket) {
        return counts.get(`${provider}|${bucket.getTime()}`) ?? 0;
      },
    };
    const q = new QuotaManager("test", {
      maxPerSecond: 100,
      maxConcurrency: 8,
      perMinuteLimit: 2,
      shared: store,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0,
    });
    (await q.acquire())();
    (await q.acquire())();
    // Une requête live n'a plus de marge (2 ≥ 60 % de 2) : refusée sans attendre.
    await expect(q.acquire("live")).rejects.toBeInstanceOf(QuotaExceededError);
    const t0 = clock.now();
    (await q.acquire("backfill"))();
    // Le plafond de la minute est atteint : attente jusqu'à la minute suivante.
    expect(minuteBucket(clock.now()).getTime()).toBeGreaterThan(minuteBucket(t0).getTime());
  });

  it("lit une configuration bornée depuis l'environnement", () => {
    expect(readQuotaEnv({})).toEqual({ maxPerSecond: 3, maxConcurrency: 2 });
    expect(
      readQuotaEnv({ FRANCE_TRAVAIL_MAX_RPS: "50", FRANCE_TRAVAIL_MAX_CONCURRENCY: "9" }),
    ).toEqual({ maxPerSecond: 8, maxConcurrency: 4 });
    expect(readQuotaEnv({ FRANCE_TRAVAIL_MAX_RPS: "0.1" })).toEqual({
      maxPerSecond: 0.5,
      maxConcurrency: 2,
    });
  });
});

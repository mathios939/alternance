import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { finishRun, startRun } from "./runs";

/**
 * EXPIRATION (Phase 7) — règles explicites, appliquées uniquement aux offres réelles :
 *   • date d'expiration fournie par la source dépassée → EXPIRED ;
 *   • non re-vérifiée depuis STALE_AFTER_DAYS → UNKNOWN (affichée avec son ancienneté) ;
 *   • non re-vérifiée depuis EXPIRE_UNVERIFIED_AFTER_DAYS → EXPIRED et retirée de la recherche ;
 *   • publiée depuis plus de MAX_AGE_DAYS → EXPIRED.
 * Les offres de démonstration ne sont jamais touchées.
 */
const log = createLogger("ingestion:expire");

export const EXPIRATION_RULES = { staleAfterDays: 14, expireUnverifiedAfterDays: 45, maxAgeDays: 120 } as const;

export type ExpireReport = { runId: string | null; expiredBySource: number; expiredUnverified: number; expiredTooOld: number; markedUnknown: number; durationMs: number };

export async function expireJobs(options: { now?: () => Date; trigger?: string } = {}): Promise<ExpireReport> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const run = await startRun({ sourceKey: "system", trigger: `expire:${options.trigger ?? "manual"}`, params: EXPIRATION_RULES });
  const stale = new Date(startedAt.getTime() - EXPIRATION_RULES.staleAfterDays * 86_400_000);
  const dead = new Date(startedAt.getTime() - EXPIRATION_RULES.expireUnverifiedAfterDays * 86_400_000);
  const tooOld = new Date(startedAt.getTime() - EXPIRATION_RULES.maxAgeDays * 86_400_000);
  const real = { isDemo: false as const };

  const bySource = await prisma.job.updateMany({ where: { ...real, isActive: true, expiresAt: { lt: startedAt } }, data: { verificationStatus: "EXPIRED", isActive: false } });
  const unverified = await prisma.job.updateMany({
    where: { ...real, isActive: true, OR: [{ lastVerifiedAt: { lt: dead } }, { lastVerifiedAt: null, discoveredAt: { lt: dead } }] },
    data: { verificationStatus: "EXPIRED", isActive: false },
  });
  const old = await prisma.job.updateMany({ where: { ...real, isActive: true, publishedAt: { lt: tooOld } }, data: { verificationStatus: "EXPIRED", isActive: false } });
  const unknown = await prisma.job.updateMany({ where: { ...real, isActive: true, verificationStatus: "ACTIVE", lastVerifiedAt: { lt: stale } }, data: { verificationStatus: "UNKNOWN" } });

  const report: ExpireReport = { runId: run.id, expiredBySource: bySource.count, expiredUnverified: unverified.count, expiredTooOld: old.count, markedUnknown: unknown.count, durationMs: now().getTime() - startedAt.getTime() };
  await finishRun(run.id, { status: "SUCCESS", startedAt, now: now(), counters: { fetchedCount: bySource.count + unverified.count + old.count + unknown.count, expiredCount: bySource.count + unverified.count + old.count, updatedCount: unknown.count } });
  log.info("Expiration terminée", { operation: "expire", status: "ok", ...report });
  return report;
}

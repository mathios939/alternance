import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getJobSourceProviders } from "@/services/job-sources";
import { QuotaExceededError } from "@/services/job-sources/quota";
import { runIngestion } from "./pipeline";
import { LOCK_TTL_MS } from "./national-sync";

/**
 * ─────────────────────────────────────────────────────────────
 * RAFRAÎCHISSEMENT LIVE D'UNE RECHERCHE (Phase 30)
 *
 * Quand un visiteur cherche « développeur à Nantes (30 km) », la réponse est servie immédiatement
 * depuis la base. Ensuite, hors du chemin de réponse (`after()`), la zone est rafraîchie auprès de
 * France Travail si, et seulement si :
 *   • la dernière actualisation de cette recherche date de plus de LIVE_TTL_MS ;
 *   • aucun autre processus ne la rafraîchit déjà (verrou sur le point de reprise LIVE_SEARCH) ;
 *   • le quota partagé de la minute laisse de la marge (priorité « live », jamais d'attente).
 * Une seule page (150 offres les plus récentes) est demandée : normalisation → dédoublonnage →
 * base. La prochaine requête voit les nouveautés ; rien n'est promis « en temps réel ».
 *
 * TTL mesuré : la synchronisation planifiée passe toutes les deux heures ; un rafraîchissement live
 * toutes les 15 minutes par zone active borne le coût à 4 requêtes/heure/zone, soit pour 100 zones
 * actives ≈ 7 requêtes/minute, très en dessous du plafond partagé (180/minute par défaut).
 * ─────────────────────────────────────────────────────────────
 */
const log = createLogger("ingestion:live");

export const LIVE_TTL_MS = 15 * 60_000;
export const LIVE_PAGE_LIMIT = 150;
export const LIVE_WINDOW_DAYS = 7;
export const LIVE_MAX_JOBS = 60;

export { liveSearchTarget, parseLiveKey } from "./live-search-key";
export type { LiveSearchTarget } from "./live-search-key";
import { liveSearchTarget, parseLiveKey, type LiveSearchTarget } from "./live-search-key";

/** Enregistre la demande (compteur de popularité) et indique si un rafraîchissement est dû. */
export async function shouldRefreshLive(
  target: LiveSearchTarget,
  now: Date = new Date(),
): Promise<{ due: boolean; lastSuccessAt: Date | null; running: boolean }> {
  // Sans identifiants France Travail (développement, tests), rien n'est planifié ni compté.
  if (!process.env["FRANCE_TRAVAIL_CLIENT_ID"] || !process.env["FRANCE_TRAVAIL_CLIENT_SECRET"])
    return { due: false, lastSuccessAt: null, running: false };
  const key = {
    provider: "france-travail",
    kind: "LIVE_SEARCH" as const,
    territory: target.key,
    window: "live",
  };
  const cp = await prisma.syncCheckpoint.upsert({
    where: { provider_kind_territory_window: key },
    create: {
      ...key,
      status: "PENDING",
      priority: 10,
      hitCount: 1,
      cursor: { label: target.label } as Prisma.InputJsonValue,
    },
    update: { hitCount: { increment: 1 } },
    select: { status: true, lastSuccessAt: true, lockedAt: true, lastStartedAt: true },
  });
  const running =
    cp.status === "RUNNING" &&
    Boolean(cp.lockedAt) &&
    now.getTime() - cp.lockedAt!.getTime() < LOCK_TTL_MS;
  const fresh =
    Boolean(cp.lastSuccessAt) && now.getTime() - cp.lastSuccessAt!.getTime() < LIVE_TTL_MS;
  // Un échec récent (quota, source indisponible) n'est pas retenté avant une minute.
  const recentAttempt =
    Boolean(cp.lastStartedAt) && now.getTime() - cp.lastStartedAt!.getTime() < 60_000;
  return { due: !running && !fresh && !recentAttempt, lastSuccessAt: cp.lastSuccessAt, running };
}

export type LiveRefreshResult = {
  key: string;
  status: "refreshed" | "skipped" | "quota" | "unavailable" | "error";
  created: number;
  updated: number;
  requests: number;
  reason?: string;
  durationMs: number;
};

/** Rafraîchit une zone (une page, priorité live). Idempotent, verrouillé, borné. */
export async function runLiveRefresh(
  target: LiveSearchTarget,
  options: { now?: () => Date; workerId?: string } = {},
): Promise<LiveRefreshResult> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const workerId = options.workerId ?? `live-${process.pid}`;
  const key = {
    provider: "france-travail",
    kind: "LIVE_SEARCH" as const,
    territory: target.key,
    window: "live",
  };
  const provider = getJobSourceProviders().find((p) => p.key === "france-travail");
  const status = provider ? await provider.status() : null;
  if (!provider || !status?.configured)
    return {
      key: target.key,
      status: "unavailable",
      created: 0,
      updated: 0,
      requests: 0,
      reason: status?.reason ?? "Source non configurée",
      durationMs: 0,
    };

  const cp = await prisma.syncCheckpoint.upsert({
    where: { provider_kind_territory_window: key },
    create: {
      ...key,
      status: "PENDING",
      priority: 10,
      cursor: { label: target.label } as Prisma.InputJsonValue,
    },
    update: {},
    select: { id: true },
  });
  const stale = new Date(startedAt.getTime() - LOCK_TTL_MS);
  const claimed = await prisma.syncCheckpoint.updateMany({
    where: {
      id: cp.id,
      OR: [{ status: { not: "RUNNING" } }, { lockedAt: null }, { lockedAt: { lt: stale } }],
      AND: [
        {
          OR: [
            { lastSuccessAt: null },
            { lastSuccessAt: { lt: new Date(startedAt.getTime() - LIVE_TTL_MS) } },
          ],
        },
      ],
    },
    data: {
      status: "RUNNING",
      lockedBy: workerId,
      lockedAt: startedAt,
      lastStartedAt: startedAt,
      runCount: { increment: 1 },
      cursor: { label: target.label } as Prisma.InputJsonValue,
    },
  });
  if (claimed.count === 0)
    return {
      key: target.key,
      status: "skipped",
      created: 0,
      updated: 0,
      requests: 0,
      reason: "Déjà à jour ou en cours",
      durationMs: 0,
    };

  try {
    const report = await runIngestion({
      provider,
      trigger: "live",
      now,
      maxJobs: LIVE_MAX_JOBS,
      params: {
        keywords: target.keywords,
        city: target.city,
        inseeCode: target.inseeCode,
        radiusKm: target.radiusKm,
        department: target.city ? undefined : target.department,
        limit: LIVE_PAGE_LIMIT,
        publishedWithinDays: LIVE_WINDOW_DAYS,
        priority: "live",
      },
    });
    const quotaHit = report.errors.some((e) => /quota/i.test(e));
    const ok = report.fetched > 0 || report.errors.length === 0;
    const durationMs = now().getTime() - startedAt.getTime();
    await prisma.syncCheckpoint.update({
      where: { id: cp.id },
      data: {
        status: ok ? "SUCCESS" : "ERROR",
        lockedBy: null,
        lockedAt: null,
        lastSuccessAt: ok ? now() : undefined,
        lastError: ok ? null : (report.errors[0]?.slice(0, 500) ?? null),
        fetchedCount: report.fetched,
        createdCount: report.created,
        updatedCount: report.updated,
        duplicateCount: report.duplicates,
        rejectedCount: report.rejected,
        failedCount: report.failed,
        requestCount: report.requests,
        durationMs,
      },
    });
    log.info("Rafraîchissement live", {
      key: target.key,
      status: ok ? "ok" : "error",
      fetched: report.fetched,
      created: report.created,
      updated: report.updated,
      requests: report.requests,
      durationMs,
    });
    return {
      key: target.key,
      status: ok ? "refreshed" : quotaHit ? "quota" : "error",
      created: report.created,
      updated: report.updated,
      requests: report.requests,
      reason: report.errors[0],
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const quota = error instanceof QuotaExceededError;
    await prisma.syncCheckpoint
      .update({
        where: { id: cp.id },
        data: { status: "ERROR", lockedBy: null, lockedAt: null, lastError: message.slice(0, 500) },
      })
      .catch(() => undefined);
    if (!quota) log.warn("Rafraîchissement live échoué", { key: target.key, error: message });
    return {
      key: target.key,
      status: quota ? "quota" : "error",
      created: 0,
      updated: 0,
      requests: 0,
      reason: message,
      durationMs: now().getTime() - startedAt.getTime(),
    };
  }
}

export type SearchFreshness = {
  /** Dernière actualisation véridique de la zone (recherche live, département, ou dernière synchro nationale). */
  lastSyncAt: string | null;
  scope: "search" | "department" | "national" | "none";
  label: string | null;
  refreshing: boolean;
};

/** Dernière actualisation applicable à une recherche, pour l'afficher honnêtement (« Synchronisé il y a … »). */
export async function getSearchFreshness(
  filters: { q?: string; city?: string; radius?: number; department?: string },
  now: Date = new Date(),
): Promise<SearchFreshness> {
  const target = liveSearchTarget(filters);
  const [live, territory, national] = await Promise.all([
    target
      ? prisma.syncCheckpoint.findUnique({
          where: {
            provider_kind_territory_window: {
              provider: "france-travail",
              kind: "LIVE_SEARCH",
              territory: target.key,
              window: "live",
            },
          },
          select: { lastSuccessAt: true, status: true, lockedAt: true },
        })
      : null,
    target?.department
      ? prisma.syncCheckpoint.findFirst({
          where: {
            provider: "france-travail",
            kind: "TERRITORY",
            territory: target.department,
            lastSuccessAt: { not: null },
          },
          orderBy: { lastSuccessAt: "desc" },
          select: { lastSuccessAt: true },
        })
      : null,
    prisma.syncCheckpoint.findFirst({
      where: { provider: "france-travail", kind: "TERRITORY", lastSuccessAt: { not: null } },
      orderBy: { lastSuccessAt: "desc" },
      select: { lastSuccessAt: true },
    }),
  ]);
  const refreshing = Boolean(
    live &&
    live.status === "RUNNING" &&
    live.lockedAt &&
    now.getTime() - live.lockedAt.getTime() < LOCK_TTL_MS,
  );
  const candidates: Array<{ at: Date; scope: SearchFreshness["scope"]; label: string }> = [];
  if (live?.lastSuccessAt && target)
    candidates.push({ at: live.lastSuccessAt, scope: "search", label: target.label });
  if (territory?.lastSuccessAt && target?.departmentName)
    candidates.push({
      at: territory.lastSuccessAt,
      scope: "department",
      label: target.departmentName,
    });
  if (national?.lastSuccessAt)
    candidates.push({ at: national.lastSuccessAt, scope: "national", label: "France" });
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  const best = candidates[0];
  return {
    lastSyncAt: best?.at.toISOString() ?? null,
    scope: best?.scope ?? "none",
    label: best?.label ?? null,
    refreshing,
  };
}

/** Recherches live les plus demandées dont l'actualisation est ancienne (rafraîchies par la synchronisation planifiée, priorité 3). */
export async function popularStaleSearches(
  limit = 20,
  olderThanMs = 2 * 3_600_000,
  now: Date = new Date(),
): Promise<LiveSearchTarget[]> {
  const rows = await prisma.syncCheckpoint.findMany({
    where: {
      provider: "france-travail",
      kind: "LIVE_SEARCH",
      hitCount: { gte: 2 },
      OR: [
        { lastSuccessAt: null },
        { lastSuccessAt: { lt: new Date(now.getTime() - olderThanMs) } },
      ],
    },
    orderBy: [{ hitCount: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: { territory: true, cursor: true },
  });
  const targets: LiveSearchTarget[] = [];
  for (const row of rows) {
    const target = parseLiveKey(row.territory);
    if (target) targets.push(target);
  }
  return targets;
}

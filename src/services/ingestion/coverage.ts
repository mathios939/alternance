import { ALL_DEPARTMENT_CODES, DEPARTMENTS, findDepartmentByCode } from "@/config/departments";
import { prisma } from "@/lib/db";

/**
 * COUVERTURE RÉELLE (Phase 30) : compteurs mesurés en base, jamais estimés.
 * Utilisé par `npm run db:coverage`, l'endpoint de santé et l'admin.
 */
export type CoverageReport = {
  checkedAt: string;
  /** Toutes les offres réelles connues (actives ou non, doublons compris) : l'historique est conservé. */
  totalOffers: number;
  /** Offres d'alternance réelles visibles dans la recherche (actives, canoniques, non expirées). */
  activeAlternance: number;
  /** Actives publiées depuis moins de 24 h / 7 jours (date de publication côté source). */
  last24h: number;
  last7Days: number;
  /** Actives découvertes par nous depuis moins de 24 h. */
  discovered24h: number;
  /** Actives dont la source a actualisé l'offre depuis moins de 24 h. */
  sourceUpdated24h: number;
  byRegion: Array<{ region: string; count: number }>;
  byDepartment: Array<{ code: string; department: string; region: string; count: number }>;
  bySource: Array<{
    key: string;
    name: string;
    type: string;
    count: number;
    lastSyncAt: string | null;
    lastSyncStatus: string;
  }>;
  territories: {
    total: number;
    /** Territoires synchronisés avec succès (toutes fenêtres confondues) depuis moins de 24 h / un jour donné. */
    synced24h: number;
    syncedEver: number;
    inProgress: number;
    errors: number;
    /** Territoires jamais synchronisés ou dont le dernier succès a plus de 24 h. */
    late: number;
    lastSyncAt: string | null;
    lastError: string | null;
    windows: Array<{ window: string; synced24h: number; syncedEver: number }>;
  };
  liveSearches: { total: number; refreshed24h: number; hits24h: number };
  removed7Days: number;
  expired7Days: number;
  /** Actives publiées depuis moins de 30 jours. */
  last30Days: number;
  byContractType: Array<{ contractType: string; count: number }>;
  bySector: Array<{ sector: string; count: number }>;
  byCity: Array<{ city: string; count: number }>;
  /** Suivi du rattrapage : un point par territoire (fenêtre la plus large synchronisée). */
  tracking: {
    done: number;
    inProgress: string[];
    errors: Array<{ territory: string; window: string; error: string | null; at: string }>;
    lastCheckpoint: { territory: string; window: string; status: string; at: string } | null;
    averageDurationMs: number | null;
    quota24h: { requests: number; rateLimited: number; errors: number; peakPerMinute: number };
    territories: Array<{
      code: string;
      name: string;
      region: string;
      status: string;
      window: string | null;
      lastSuccessAt: string | null;
      durationMs: number | null;
      created: number;
      fetched: number;
      error: string | null;
    }>;
  };
};

export const VISIBLE_REAL_JOB_WHERE = {
  isActive: true as const,
  canonicalJobId: null,
  isDemo: false as const,
  verificationStatus: { notIn: ["EXPIRED", "REMOVED"] as ("EXPIRED" | "REMOVED")[] },
};

export async function getCoverageReport(now: Date = new Date()): Promise<CoverageReport> {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const visible = VISIBLE_REAL_JOB_WHERE;
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const [last30Days, contractTypes, sectors, cities, quotaRows] = await Promise.all([
    prisma.job.count({ where: { ...VISIBLE_REAL_JOB_WHERE, publishedAt: { gte: monthAgo } } }),
    prisma.job.groupBy({
      by: ["contractType"],
      where: VISIBLE_REAL_JOB_WHERE,
      _count: { _all: true },
    }),
    prisma.job.groupBy({ by: ["sector"], where: VISIBLE_REAL_JOB_WHERE, _count: { _all: true } }),
    prisma.job.groupBy({
      by: ["city"],
      where: VISIBLE_REAL_JOB_WHERE,
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
      take: 25,
    }),
    prisma.providerQuota.findMany({
      where: { bucket: { gte: dayAgo } },
      select: { requests: true, rateLimited: true, errors: true },
    }),
  ]);
  const [
    totalOffers,
    activeAlternance,
    last24h,
    last7Days,
    discovered24h,
    sourceUpdated24h,
    regions,
    departments,
    sources,
    checkpoints,
    live,
    removed7Days,
    expired7Days,
  ] = await Promise.all([
    prisma.job.count({ where: { isDemo: false } }),
    prisma.job.count({ where: visible }),
    prisma.job.count({ where: { ...visible, publishedAt: { gte: dayAgo } } }),
    prisma.job.count({ where: { ...visible, publishedAt: { gte: weekAgo } } }),
    prisma.job.count({ where: { ...visible, discoveredAt: { gte: dayAgo } } }),
    prisma.job.count({ where: { ...visible, sourceUpdatedAt: { gte: dayAgo } } }),
    prisma.job.groupBy({ by: ["region"], where: visible, _count: { _all: true } }),
    prisma.job.groupBy({ by: ["department"], where: visible, _count: { _all: true } }),
    prisma.jobSource.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        type: true,
        lastSyncAt: true,
        lastSyncStatus: true,
      },
    }),
    // Couverture nationale France Travail uniquement : les points de reprise des autres sources ont leur propre provider.
    prisma.syncCheckpoint.findMany({
      where: { kind: "TERRITORY", provider: "france-travail" },
      select: {
        territory: true,
        window: true,
        status: true,
        lastSuccessAt: true,
        lastError: true,
        updatedAt: true,
        durationMs: true,
        createdCount: true,
        fetchedCount: true,
        lastStartedAt: true,
      },
    }),
    prisma.syncCheckpoint.findMany({
      where: { kind: "LIVE_SEARCH" },
      select: { lastSuccessAt: true, hitCount: true, updatedAt: true },
    }),
    prisma.job.count({
      where: { isDemo: false, verificationStatus: "REMOVED", lastVerifiedAt: { gte: weekAgo } },
    }),
    prisma.job.count({
      where: { isDemo: false, verificationStatus: "EXPIRED", updatedAt: { gte: weekAgo } },
    }),
  ]);
  const bySourceCounts = await Promise.all(
    sources.map((s) =>
      prisma.jobSourceEntry.count({
        where: { sourceId: s.id, status: { in: ["ACTIVE", "UNKNOWN"] }, job: visible },
      }),
    ),
  );

  const nameToCode = new Map(DEPARTMENTS.map((d) => [d.name, d.code]));
  const byDepartment = departments
    .map((d) => {
      const code = d.department ? (nameToCode.get(d.department) ?? "") : "";
      const dep = findDepartmentByCode(code);
      return {
        code: code || "—",
        department: d.department ?? "Non précisé",
        region: dep?.region ?? "—",
        count: d._count._all,
      };
    })
    .sort((a, b) => b.count - a.count);
  const byRegion = regions
    .map((r) => ({ region: r.region ?? "Non précisée", count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const successByTerritory = new Map<string, Date>();
  const territoryStatus = new Map<string, { status: string; updatedAt: Date }>();
  let lastError: string | null = null;
  let lastErrorAt = 0;
  const windows = new Map<string, { synced24h: Set<string>; syncedEver: Set<string> }>();
  for (const cp of checkpoints) {
    const w = windows.get(cp.window) ?? {
      synced24h: new Set<string>(),
      syncedEver: new Set<string>(),
    };
    if (cp.lastSuccessAt) {
      w.syncedEver.add(cp.territory);
      if (cp.lastSuccessAt >= dayAgo) w.synced24h.add(cp.territory);
      const prev = successByTerritory.get(cp.territory);
      if (!prev || prev < cp.lastSuccessAt) successByTerritory.set(cp.territory, cp.lastSuccessAt);
    }
    windows.set(cp.window, w);
    const prevStatus = territoryStatus.get(cp.territory);
    if (!prevStatus || prevStatus.updatedAt < cp.updatedAt)
      territoryStatus.set(cp.territory, { status: cp.status, updatedAt: cp.updatedAt });
    if (cp.status === "ERROR" && cp.lastError && cp.updatedAt.getTime() > lastErrorAt) {
      lastError = cp.lastError;
      lastErrorAt = cp.updatedAt.getTime();
    }
  }
  const synced24h = [...successByTerritory.values()].filter((d) => d >= dayAgo).length;
  const lastSync =
    [...successByTerritory.values()].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const territories = {
    total: ALL_DEPARTMENT_CODES.length,
    synced24h,
    syncedEver: successByTerritory.size,
    inProgress: [...territoryStatus.values()].filter((s) => s.status === "RUNNING").length,
    errors: [...territoryStatus.values()].filter((s) => s.status === "ERROR").length,
    late: ALL_DEPARTMENT_CODES.length - synced24h,
    lastSyncAt: lastSync?.toISOString() ?? null,
    lastError,
    windows: [...windows.entries()]
      .map(([window, w]) => ({
        window,
        synced24h: w.synced24h.size,
        syncedEver: w.syncedEver.size,
      }))
      .sort((a, b) => a.window.localeCompare(b.window)),
  };

  // Suivi par territoire : la fenêtre la plus large synchronisée avec succès l'emporte ; sinon l'état le plus récent.
  const windowDays = (w: string) => Number(w.replace(/d$/, "")) || 0;
  const perTerritory = new Map<string, (typeof checkpoints)[number]>();
  for (const cp of checkpoints) {
    const prev = perTerritory.get(cp.territory);
    const better =
      !prev ||
      (cp.lastSuccessAt &&
        (!prev.lastSuccessAt || windowDays(cp.window) > windowDays(prev.window))) ||
      (!prev.lastSuccessAt && cp.updatedAt > prev.updatedAt);
    if (better) perTerritory.set(cp.territory, cp);
  }
  const territoriesDetail = DEPARTMENTS.map((d) => {
    const cp = perTerritory.get(d.code);
    return {
      code: d.code,
      name: d.name,
      region: d.region,
      status: cp
        ? cp.lastSuccessAt
          ? cp.status === "RUNNING"
            ? "RUNNING"
            : cp.status === "SUCCESS"
              ? "DONE"
              : cp.status
          : cp.status
        : "PENDING",
      window: cp?.window ?? null,
      lastSuccessAt: cp?.lastSuccessAt?.toISOString() ?? null,
      durationMs: cp?.durationMs ?? null,
      created: cp?.createdCount ?? 0,
      fetched: cp?.fetchedCount ?? 0,
      error: cp?.lastError ?? null,
    };
  });
  const successDurations = checkpoints
    .filter((c) => c.lastSuccessAt && c.durationMs !== null && windowDays(c.window) >= 31)
    .map((c) => c.durationMs!);
  const lastCp =
    [...checkpoints].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
  const tracking: CoverageReport["tracking"] = {
    done: territoriesDetail.filter((t) => t.lastSuccessAt !== null).length,
    inProgress: [...territoryStatus.entries()]
      .filter(([, s]) => s.status === "RUNNING")
      .map(([t]) => t),
    errors: checkpoints
      .filter((c) => c.status === "ERROR")
      .map((c) => ({
        territory: c.territory,
        window: c.window,
        error: c.lastError,
        at: c.updatedAt.toISOString(),
      })),
    lastCheckpoint: lastCp
      ? {
          territory: lastCp.territory,
          window: lastCp.window,
          status: lastCp.status,
          at: lastCp.updatedAt.toISOString(),
        }
      : null,
    averageDurationMs: successDurations.length
      ? Math.round(successDurations.reduce((a, b) => a + b, 0) / successDurations.length)
      : null,
    quota24h: {
      requests: quotaRows.reduce((s, r) => s + r.requests, 0),
      rateLimited: quotaRows.reduce((s, r) => s + r.rateLimited, 0),
      errors: quotaRows.reduce((s, r) => s + r.errors, 0),
      peakPerMinute: quotaRows.reduce((m, r) => Math.max(m, r.requests), 0),
    },
    territories: territoriesDetail,
  };

  return {
    checkedAt: now.toISOString(),
    totalOffers,
    activeAlternance,
    last24h,
    last7Days,
    discovered24h,
    sourceUpdated24h,
    byRegion,
    byDepartment,
    bySource: sources.map((s, i) => ({
      key: s.key,
      name: s.name,
      type: s.type,
      count: bySourceCounts[i] ?? 0,
      lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: s.lastSyncStatus,
    })),
    territories,
    liveSearches: {
      total: live.length,
      refreshed24h: live.filter((l) => l.lastSuccessAt && l.lastSuccessAt >= dayAgo).length,
      hits24h: live.filter((l) => l.updatedAt >= dayAgo).reduce((s, l) => s + l.hitCount, 0),
    },
    removed7Days,
    expired7Days,
    last30Days,
    byContractType: contractTypes
      .map((c) => ({ contractType: c.contractType, count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    bySector: sectors
      .map((c) => ({ sector: c.sector, count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    byCity: cities.map((c) => ({ city: c.city, count: c._count._all })),
    tracking,
  };
}

/** Rendu texte du rapport (scripts, résumés de workflow). Format demandé : TOTAL_OFFERS, ACTIVE_ALTERNANCE, LAST_24H… */
export function formatCoverageReport(
  r: CoverageReport,
  options: { maxDepartments?: number } = {},
): string {
  const lines: string[] = [];
  const regionOf = (name: string) => r.byRegion.find((x) => x.region === name)?.count ?? 0;
  const others = r.byRegion
    .filter((x) => x.region !== "Pays de la Loire" && x.region !== "Bretagne")
    .reduce((s, x) => s + x.count, 0);
  lines.push(`TOTAL_OFFERS: ${r.totalOffers}`);
  lines.push(`ACTIVE_ALTERNANCE: ${r.activeAlternance}`);
  lines.push(`LAST_24H: ${r.last24h}`);
  lines.push(`LAST_7_DAYS: ${r.last7Days}`);
  lines.push(`LAST_30_DAYS: ${r.last30Days}`);
  lines.push(`DISCOVERED_24H: ${r.discovered24h}`);
  lines.push(`PAYS_DE_LA_LOIRE: ${regionOf("Pays de la Loire")}`);
  lines.push(`BRETAGNE: ${regionOf("Bretagne")}`);
  lines.push(`AUTRES_REGIONS: ${others}`);
  lines.push("BY_REGION:");
  for (const x of r.byRegion) lines.push(`  ${x.region}: ${x.count}`);
  lines.push("BY_DEPARTMENT:");
  const deps = options.maxDepartments
    ? r.byDepartment.slice(0, options.maxDepartments)
    : r.byDepartment;
  for (const x of deps) lines.push(`  ${x.code} ${x.department}: ${x.count}`);
  if (options.maxDepartments && r.byDepartment.length > options.maxDepartments)
    lines.push(`  … ${r.byDepartment.length - options.maxDepartments} autre(s) département(s)`);
  lines.push("BY_CONTRACT_TYPE:");
  for (const x of r.byContractType) lines.push(`  ${x.contractType}: ${x.count}`);
  lines.push("BY_SECTOR:");
  for (const x of r.bySector) lines.push(`  ${x.sector}: ${x.count}`);
  lines.push("BY_CITY (25 premières):");
  for (const x of r.byCity) lines.push(`  ${x.city}: ${x.count}`);
  lines.push("BY_SOURCE:");
  for (const x of r.bySource)
    lines.push(
      `  ${x.name} (${x.key}): ${x.count} · dernière synchro ${x.lastSyncAt ?? "jamais"} · ${x.lastSyncStatus}`,
    );
  lines.push(`TERRITORIES_SYNCED_24H: ${r.territories.synced24h} / ${r.territories.total}`);
  lines.push(`TERRITORIES_SYNCED_EVER: ${r.territories.syncedEver} / ${r.territories.total}`);
  for (const w of r.territories.windows)
    lines.push(
      `  fenêtre ${w.window}: ${w.synced24h} synchronisés < 24 h · ${w.syncedEver} au moins une fois`,
    );
  lines.push(`TERRITORIES_DONE (au moins une fois): ${r.tracking.done} / ${r.territories.total}`);
  lines.push(
    `TERRITORIES_IN_PROGRESS: ${r.territories.inProgress}${r.tracking.inProgress.length ? ` (${r.tracking.inProgress.join(", ")})` : ""}`,
  );
  lines.push(
    `LAST_CHECKPOINT: ${r.tracking.lastCheckpoint ? `${r.tracking.lastCheckpoint.territory} · ${r.tracking.lastCheckpoint.window} · ${r.tracking.lastCheckpoint.status} · ${r.tracking.lastCheckpoint.at}` : "aucun"}`,
  );
  lines.push(
    `AVG_DURATION_PER_DEPARTMENT: ${r.tracking.averageDurationMs !== null ? `${Math.round(r.tracking.averageDurationMs / 1000)} s` : "—"}`,
  );
  lines.push(
    `API_24H: ${r.tracking.quota24h.requests} requêtes · pic ${r.tracking.quota24h.peakPerMinute}/min · 429 : ${r.tracking.quota24h.rateLimited} · erreurs : ${r.tracking.quota24h.errors}`,
  );
  lines.push(
    `TERRITORIES_ERRORS: ${r.territories.errors}${r.territories.lastError ? ` (dernière : ${r.territories.lastError})` : ""}`,
  );
  lines.push(`TERRITORIES_LATE: ${r.territories.late}`);
  lines.push(`LAST_SYNC: ${r.territories.lastSyncAt ?? "jamais"}`);
  lines.push(
    `LIVE_SEARCHES: ${r.liveSearches.total} (${r.liveSearches.refreshed24h} rafraîchies < 24 h, ${r.liveSearches.hits24h} demandes < 24 h)`,
  );
  lines.push(`REMOVED_7_DAYS: ${r.removed7Days} · EXPIRED_7_DAYS: ${r.expired7Days}`);
  return lines.join("\n");
}

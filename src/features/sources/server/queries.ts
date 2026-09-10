import "server-only";
import { prisma } from "@/lib/db";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getJobSourceProviders, type ProviderCapabilities, type ProviderStatus } from "@/services/job-sources";
import { getCompanyDataProviders } from "@/services/company-data";

export type SourceOverview = {
  key: string;
  name: string;
  type: string;
  configured: boolean;
  reason: string | null;
  missing: string[];
  capabilities: ProviderCapabilities;
  priority: number;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
  activeJobs: number;
  totalEntries: number;
  lastRun: { id: string; status: string; startedAt: Date; finishedAt: Date | null; fetchedCount: number; createdCount: number; updatedCount: number; duplicateCount: number; rejectedCount: number; failedCount: number; errorSummary: string | null } | null;
};

/** Vue d'ensemble des sources (page publique /sources et admin) : jamais de compte simulé. */
export async function getSourcesOverview(): Promise<{ sources: SourceOverview[]; companyProviders: Array<{ key: string; name: string; configured: boolean; reason?: string }>; demoMode: boolean; lastRunAt: Date | null }> {
  const providers = getJobSourceProviders();
  const [statuses, rows] = await Promise.all([Promise.all(providers.map((p) => p.status())), prisma.jobSource.findMany({ include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } } })]);
  const statusByKey = new Map<string, ProviderStatus>(statuses.map((s) => [s.key, s]));
  const sources: SourceOverview[] = [];
  for (const provider of providers) {
    const row = rows.find((r) => r.key === provider.key);
    const status = statusByKey.get(provider.key)!;
    const [activeJobs, totalEntries] = row
      ? await Promise.all([
          prisma.jobSourceEntry.count({ where: { sourceId: row.id, status: { in: ["ACTIVE", "UNKNOWN"] }, job: { isActive: true, canonicalJobId: null, isDemo: false } } }),
          prisma.jobSourceEntry.count({ where: { sourceId: row.id } }),
        ])
      : [0, 0];
    const run = row?.runs[0] ?? null;
    sources.push({
      key: provider.key,
      name: provider.name,
      type: provider.type,
      configured: status.configured,
      reason: status.reason ?? null,
      missing: status.missing ?? [],
      capabilities: provider.capabilities,
      priority: provider.priority,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastSyncStatus: row?.lastSyncStatus ?? "IDLE",
      lastSyncError: row?.lastSyncError ?? null,
      activeJobs,
      totalEntries,
      lastRun: run ? { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, fetchedCount: run.fetchedCount, createdCount: run.createdCount, updatedCount: run.updatedCount, duplicateCount: run.duplicateCount, rejectedCount: run.rejectedCount, failedCount: run.failedCount, errorSummary: run.errorSummary } : null,
    });
  }
  const companyProviders = await Promise.all(getCompanyDataProviders().map(async (p) => ({ ...(await p.status()) })));
  const lastRun = await prisma.ingestionRun.findFirst({ where: { status: { in: ["SUCCESS", "PARTIAL"] } }, orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true } });
  return { sources, companyProviders: companyProviders.map((p) => ({ key: p.key, name: p.name, configured: p.configured, reason: p.reason })), demoMode: isDemoModeEnabled(), lastRunAt: lastRun?.finishedAt ?? lastRun?.startedAt ?? null };
}

/** Statistiques de qualité des données (admin, Phase 27). */
export async function getDataQualityStats() {
  const real = { isDemo: false };
  const [
    jobsReal, jobsDemo, activeReal, byStatus, unverified7d, duplicatesAttached, probableDuplicates, lowQuality, companiesReal, companiesDemo, companiesSiren, companiesPlaceholderJobs, contactsVerified, contactsDemo, contactsOptOut, runs,
  ] = await Promise.all([
    prisma.job.count({ where: real }),
    prisma.job.count({ where: { isDemo: true } }),
    prisma.job.count({ where: { ...real, isActive: true, canonicalJobId: null } }),
    prisma.job.groupBy({ by: ["verificationStatus"], where: real, _count: { _all: true } }),
    prisma.job.count({ where: { ...real, isActive: true, OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] } }),
    prisma.jobSourceEntry.count({ where: { duplicateConfidence: { not: null } } }),
    prisma.job.count({ where: { ...real, canonicalJobId: { not: null } } }),
    prisma.job.count({ where: { ...real, isActive: true, dataQualityScore: { lt: 50 } } }),
    prisma.company.count({ where: { isDemo: false, isPlaceholder: false } }),
    prisma.company.count({ where: { isDemo: true } }),
    prisma.company.count({ where: { siren: { not: null } } }),
    prisma.job.count({ where: { ...real, isActive: true, company: { isPlaceholder: true } } }),
    prisma.contact.count({ where: { isDemo: false, verifiedAt: { not: null }, optOutAt: null } }),
    prisma.contact.count({ where: { isDemo: true } }),
    prisma.contact.count({ where: { optOutAt: { not: null } } }),
    prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s.verificationStatus, s._count._all])) as Partial<Record<string, number>>;
  return {
    jobs: { real: jobsReal, demo: jobsDemo, activeReal, active: status["ACTIVE"] ?? 0, unknown: status["UNKNOWN"] ?? 0, expired: status["EXPIRED"] ?? 0, removed: status["REMOVED"] ?? 0, unverified7d, lowQuality, anonymousEmployer: companiesPlaceholderJobs },
    duplicates: { attached: duplicatesAttached, probable: probableDuplicates },
    companies: { real: companiesReal, demo: companiesDemo, withSiren: companiesSiren },
    contacts: { verified: contactsVerified, demo: contactsDemo, optOut: contactsOptOut },
    runs,
    demoMode: isDemoModeEnabled(),
  };
}

export type ProviderMetrics = {
  key: string;
  name: string;
  type: string;
  configured: boolean;
  reason: string | null;
  status: string;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  /** Offres visibles portées par cette source. */
  activeJobs: number;
  /** Offres visibles découvertes il y a moins de 24 h via cette source. */
  newJobs24h: number;
  /** Offres visibles dont cette source est la SEULE porteuse (apport unique). */
  uniqueJobs: number;
  /** Offres visibles portées par cette source ET par une autre (doublons inter-sources). */
  sharedJobs: number;
  /** Exécutions en erreur sur 24 h. */
  errors24h: number;
  runs24h: number;
  /** Durée moyenne d'une exécution sur 24 h (ms). */
  averageLatencyMs: number | null;
  /** Fraîcheur de la source : minutes depuis le dernier succès (null si jamais). */
  freshnessMinutes: number | null;
};

/** Métriques par source pour l'admin (statut, fraîcheur, apport unique, doublons, erreurs, latence). */
export async function getProviderMetrics(now = new Date()): Promise<ProviderMetrics[]> {
  const providers = getJobSourceProviders();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const rows = await prisma.jobSource.findMany({ select: { id: true, key: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true } });
  const visible = { isActive: true as const, canonicalJobId: null, isDemo: false as const, verificationStatus: { notIn: ["EXPIRED", "REMOVED"] as ("EXPIRED" | "REMOVED")[] } };
  const alive = { in: ["ACTIVE", "UNKNOWN"] as ("ACTIVE" | "UNKNOWN")[] };
  const out: ProviderMetrics[] = [];
  for (const provider of providers) {
    const status = await provider.status();
    const row = rows.find((r) => r.key === provider.key);
    if (!row) {
      out.push({ key: provider.key, name: provider.name, type: provider.type, configured: status.configured, reason: status.reason ?? null, status: "IDLE", lastSyncAt: null, lastSuccessAt: null, lastErrorAt: null, lastError: null, activeJobs: 0, newJobs24h: 0, uniqueJobs: 0, sharedJobs: 0, errors24h: 0, runs24h: 0, averageLatencyMs: null, freshnessMinutes: null });
      continue;
    }
    const [activeJobs, newJobs24h, sharedJobs, lastSuccess, lastErrorRun, runs24h] = await Promise.all([
      prisma.job.count({ where: { ...visible, sourceEntries: { some: { sourceId: row.id, status: alive } } } }),
      prisma.job.count({ where: { ...visible, discoveredAt: { gte: dayAgo }, sourceEntries: { some: { sourceId: row.id, status: alive } } } }),
      prisma.job.count({ where: { ...visible, sourceEntries: { some: { sourceId: row.id, status: alive } }, AND: [{ sourceEntries: { some: { sourceId: { not: row.id }, status: alive } } }] } }),
      prisma.ingestionRun.findFirst({ where: { sourceKey: provider.key, status: "SUCCESS" }, orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true } }),
      prisma.ingestionRun.findFirst({ where: { sourceKey: provider.key, status: "ERROR" }, orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true, errorSummary: true } }),
      prisma.ingestionRun.findMany({ where: { sourceKey: provider.key, startedAt: { gte: dayAgo } }, select: { status: true, durationMs: true } }),
    ]);
    const durations = runs24h.map((r) => r.durationMs).filter((d): d is number => d !== null);
    const lastSuccessAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;
    out.push({
      key: provider.key,
      name: provider.name,
      type: provider.type,
      configured: status.configured,
      reason: status.reason ?? null,
      status: row.lastSyncStatus,
      lastSyncAt: row.lastSyncAt,
      lastSuccessAt,
      lastErrorAt: lastErrorRun?.finishedAt ?? lastErrorRun?.startedAt ?? null,
      lastError: lastErrorRun?.errorSummary ?? row.lastSyncError,
      activeJobs,
      newJobs24h,
      uniqueJobs: activeJobs - sharedJobs,
      sharedJobs,
      errors24h: runs24h.filter((r) => r.status === "ERROR").length,
      runs24h: runs24h.length,
      averageLatencyMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      freshnessMinutes: lastSuccessAt ? Math.round((now.getTime() - lastSuccessAt.getTime()) / 60_000) : null,
    });
  }
  return out;
}

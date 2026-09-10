import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getJobSourceProviders } from "@/services/job-sources";
import { getCompanyDataProvider } from "@/services/company-data";
import { getCoverageReport } from "@/services/ingestion/coverage";

export const dynamic = "force-dynamic";

/**
 * ÉTAT DE SANTÉ (production) : app, base de données, sources configurées, IA et itinéraires.
 * Aucune valeur secrète, aucun appel réseau sortant : seule la configuration et la base sont lues.
 * 200 si l'application et la base répondent, 503 sinon.
 */
export async function GET() {
  const env = process.env;
  const started = Date.now();
  let database: "healthy" | "unhealthy" = "unhealthy";
  let databaseLatencyMs: number | null = null;
  let data: {
    activeJobs: number;
    realActiveJobs: number;
    companies: number;
    lastSync: {
      sourceKey: string;
      status: string;
      finishedAt: string | null;
      created: number;
      updated: number;
    } | null;
  } | null = null;
  let coverage: {
    activeAlternance: number;
    last24h: number;
    last7Days: number;
    discovered24h: number;
    territoriesSynced24h: number;
    territoriesSyncedEver: number;
    territoriesTotal: number;
    territoriesInProgress: number;
    territoriesErrors: number;
    lastSyncAt: string | null;
    byRegion: Array<{ region: string; count: number }>;
  } | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    databaseLatencyMs = Date.now() - t0;
    database = "healthy";
    const visible = {
      isActive: true,
      canonicalJobId: null as string | null,
      verificationStatus: { notIn: ["EXPIRED", "REMOVED"] as ("EXPIRED" | "REMOVED")[] },
    };
    const [activeJobs, realActiveJobs, companies, lastRun] = await Promise.all([
      prisma.job.count({
        where: { ...visible, ...(isDemoModeEnabled() ? {} : { isDemo: false }) },
      }),
      prisma.job.count({ where: { ...visible, isDemo: false } }),
      prisma.company.count({ where: { isPlaceholder: false, isDemo: false } }),
      prisma.ingestionRun.findFirst({
        where: { status: { not: "RUNNING" } },
        orderBy: { startedAt: "desc" },
        select: {
          sourceKey: true,
          status: true,
          finishedAt: true,
          createdCount: true,
          updatedCount: true,
        },
      }),
    ]);
    data = {
      activeJobs,
      realActiveJobs,
      companies,
      lastSync: lastRun
        ? {
            sourceKey: lastRun.sourceKey,
            status: lastRun.status,
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
            created: lastRun.createdCount,
            updated: lastRun.updatedCount,
          }
        : null,
    };
    const c = await getCoverageReport();
    coverage = {
      activeAlternance: c.activeAlternance,
      last24h: c.last24h,
      last7Days: c.last7Days,
      discovered24h: c.discovered24h,
      territoriesSynced24h: c.territories.synced24h,
      territoriesSyncedEver: c.territories.syncedEver,
      territoriesTotal: c.territories.total,
      territoriesInProgress: c.territories.inProgress,
      territoriesErrors: c.territories.errors,
      lastSyncAt: c.territories.lastSyncAt,
      byRegion: c.byRegion.slice(0, 20),
    };
  } catch {
    database = "unhealthy";
  }

  const providers = getJobSourceProviders(env);
  const franceTravail = providers.find((p) => p.key === "france-travail");
  const franceTravailStatus = franceTravail ? await franceTravail.status() : { configured: false };
  const laBonneAlternance = providers.find((p) => p.key === "la-bonne-alternance");
  const laBonneAlternanceStatus = laBonneAlternance
    ? await laBonneAlternance.status()
    : { configured: false };
  const companyProvider =
    (env["COMPANY_DATA_PROVIDER"] ?? "recherche-entreprises") !== "none"
      ? getCompanyDataProvider()
      : undefined;
  const aiProvider = env["AI_PROVIDER"];
  const aiConfigured =
    (aiProvider === "anthropic" && Boolean(env["ANTHROPIC_API_KEY"])) ||
    (aiProvider === "openai" && Boolean(env["OPENAI_API_KEY"]));
  const osrmConfigured = env["TRAVEL_TIME_PROVIDER"] === "osrm" && Boolean(env["OSRM_BASE_URL"]);

  const body = {
    app: "healthy",
    database,
    databaseLatencyMs,
    demoMode: isDemoModeEnabled(env),
    services: {
      franceTravail: franceTravailStatus.configured ? "configured" : "not_configured",
      laBonneAlternance: laBonneAlternanceStatus.configured ? "configured" : "not_configured",
      companyData: companyProvider ? "available" : "not_configured",
      ai: aiConfigured ? "configured" : aiProvider === "mock" ? "mock" : "not_configured",
      travelTime: osrmConfigured ? "configured" : "not_configured",
      cron: env["CRON_SECRET"] ? "configured" : "not_configured",
    },
    data,
    coverage,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  };
  return NextResponse.json(body, {
    status: database === "healthy" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}

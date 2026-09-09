import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { getJobSourceProviders } from "@/services/job-sources";

/**
 * Tâches planifiées (Phase 28) : les mêmes fonctions que les commandes CLI, exposées en HTTP
 * pour un ordonnanceur externe (Vercel Cron, GitHub Actions, cron système…).
 * Protégées par CRON_SECRET (en-tête `Authorization: Bearer <secret>`), jamais par défaut ouvertes.
 *   GET /api/cron/sync     → synchronisation France Travail (départements prioritaires)
 *   GET /api/cron/verify   → re-vérification des offres
 *   GET /api/cron/expire   → expiration
 *   GET /api/cron/companies → import ciblé d'entreprises
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("cron");

export async function GET(request: Request, ctx: RouteContext<"/api/cron/[task]">) {
  const { task } = await ctx.params;
  const secret = process.env["CRON_SECRET"];
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré : tâches planifiées désactivées." }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  getEnv();
  const started = Date.now();
  try {
    if (task === "sync") {
      const { runIngestion } = await import("@/services/ingestion");
      const { PRIORITY_DEPARTMENT_CODES } = await import("@/config/departments");
      const provider = getJobSourceProviders().find((p) => p.key === "france-travail")!;
      const reports = [];
      for (const department of PRIORITY_DEPARTMENT_CODES) reports.push(await runIngestion({ provider, params: { department, publishedWithinDays: 7 }, trigger: "cron" }));
      return NextResponse.json({ task, durationMs: Date.now() - started, reports });
    }
    if (task === "verify") {
      const { verifySourceJobs } = await import("@/services/ingestion");
      const provider = getJobSourceProviders().find((p) => p.key === "france-travail")!;
      return NextResponse.json({ task, durationMs: Date.now() - started, report: await verifySourceJobs({ provider, olderThanHours: 24, limit: 300, trigger: "cron" }) });
    }
    if (task === "expire") {
      const { expireJobs } = await import("@/services/ingestion");
      return NextResponse.json({ task, durationMs: Date.now() - started, report: await expireJobs({ trigger: "cron" }) });
    }
    if (task === "companies") {
      const { importCompanies } = await import("@/services/company-data/import");
      const { getCompanyDataProvider, JOB_FAMILY_NAF_HINTS } = await import("@/services/company-data");
      const { PRIORITY_DEPARTMENT_CODES } = await import("@/config/departments");
      const provider = getCompanyDataProvider()!;
      const reports = [];
      for (const department of PRIORITY_DEPARTMENT_CODES.slice(0, 3)) reports.push(await importCompanies({ provider, params: { nafCodes: JOB_FAMILY_NAF_HINTS["dev"], departmentCodes: [department] }, maxRecords: 50, trigger: "cron" }));
      return NextResponse.json({ task, durationMs: Date.now() - started, reports });
    }
    return NextResponse.json({ error: `Tâche inconnue : ${task}` }, { status: 404 });
  } catch (error) {
    log.error("Tâche planifiée échouée", error, { task });
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { normalizeJob } from "@/services/job-sources/normalize";
import type { JobSourceProvider } from "@/services/job-sources/types";
import { calculateJobDataQuality } from "./quality";
import { refreshCanonicalApplication } from "./pipeline";
import { finishRun, startRun } from "./runs";

/**
 * VÉRIFICATION (Phase 7) : re-contrôle périodique de l'existence des offres auprès de leur source.
 * ACTIVE → date de vérification rafraîchie ; retirée → l'entrée passe REMOVED, et l'offre aussi
 * si plus aucune source ne la porte. Une erreur réseau ne modifie rien (statut UNKNOWN compté).
 */
const log = createLogger("ingestion:verify");

export type VerifyReport = {
  sourceKey: string;
  runId: string | null;
  checked: number;
  active: number;
  removed: number;
  unknown: number;
  skipped: boolean;
  reason?: string;
  durationMs: number;
};

export async function verifySourceJobs(options: {
  provider: JobSourceProvider;
  olderThanHours?: number;
  limit?: number;
  trigger?: string;
  now?: () => Date;
}): Promise<VerifyReport> {
  const { provider, olderThanHours = 24, limit = 200, trigger = "manual" } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const report: VerifyReport = {
    sourceKey: provider.key,
    runId: null,
    checked: 0,
    active: 0,
    removed: 0,
    unknown: 0,
    skipped: false,
    durationMs: 0,
  };

  const status = await provider.status();
  if (!status.configured || !provider.capabilities.supportsVerification || !provider.verifyJobs) {
    report.skipped = true;
    report.reason = !status.configured
      ? (status.reason ?? "Provider non configuré")
      : "Cette source ne permet pas de vérifier une offre";
    log.warn("Vérification ignorée", {
      provider: provider.key,
      operation: "verify",
      status: "skipped",
      reason: report.reason,
    });
    return report;
  }
  const source = await prisma.jobSource.findUnique({
    where: { key: provider.key },
    select: { id: true },
  });
  if (!source) {
    report.skipped = true;
    report.reason = "Aucune ingestion enregistrée pour cette source";
    return report;
  }
  const cutoff = new Date(startedAt.getTime() - olderThanHours * 3_600_000);
  const entries = await prisma.jobSourceEntry.findMany({
    where: {
      sourceId: source.id,
      status: { in: ["ACTIVE", "UNKNOWN"] },
      job: { isDemo: false },
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: cutoff } }],
    },
    // Priorité aux offres absentes du dernier listage complet de leur département (probablement retirées).
    orderBy: [{ missedListings: "desc" }, { lastVerifiedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true, jobId: true, externalId: true },
  });
  const run = await startRun({
    sourceKey: provider.key,
    sourceId: source.id,
    trigger: `verify:${trigger}`,
    params: { olderThanHours, limit },
  });
  report.runId = run.id;
  const errors: string[] = [];
  const touchedJobs = new Set<string>();
  try {
    for (let i = 0; i < entries.length; i += 50) {
      const chunk = entries.slice(i, i + 50);
      const results = await provider.verifyJobs(chunk.map((e) => e.externalId));
      for (const result of results) {
        const entry = chunk.find((e) => e.externalId === result.externalId);
        if (!entry) continue;
        report.checked++;
        const ts = now();
        if (result.status === "ACTIVE") {
          report.active++;
          const job = result.job
            ? normalizeJob(result.job, { key: provider.key, type: provider.type, isDemo: false })
            : null;
          await prisma.jobSourceEntry.update({
            where: { id: entry.id },
            data: {
              status: "ACTIVE",
              lastVerifiedAt: ts,
              lastSeenAt: ts,
              missedListings: 0,
              sourceUpdatedAt: job?.updatedAt ?? undefined,
              expiresAt: job?.expiresAt ?? undefined,
            },
          });
          await prisma.job.update({
            where: { id: entry.jobId },
            data: {
              verificationStatus: "ACTIVE",
              lastVerifiedAt: ts,
              isActive: true,
              ...(job
                ? {
                    title: job.title,
                    normalizedTitle: job.normalizedTitle,
                    description: job.description,
                    skillsText: job.skillsText,
                    salaryMin: job.salaryMin,
                    salaryMax: job.salaryMax,
                    salaryPeriod: job.salaryPeriod,
                    expiresAt: job.expiresAt,
                    sourceUpdatedAt: job.updatedAt,
                    dataQualityScore: calculateJobDataQuality(
                      {
                        title: job.title,
                        description: job.description,
                        companyKnown: Boolean(job.companyNameRaw),
                        city: job.city,
                        hasCoordinates: job.latitude !== null,
                        applicationUrl: job.applicationUrl,
                        sourceKnown: true,
                        publishedAt: job.publishedAt,
                        lastVerifiedAt: ts,
                        educationLevelKnown: job.educationLevelMin !== null,
                        salaryKnown: job.salaryMin !== null,
                        durationKnown: job.durationMonths !== null,
                        skillsCount: job.skillsText.length,
                      },
                      ts,
                    ).score,
                  }
                : {}),
            },
          });
        } else if (result.status === "REMOVED") {
          report.removed++;
          await prisma.jobSourceEntry.update({
            where: { id: entry.id },
            data: { status: "REMOVED", lastVerifiedAt: ts },
          });
          touchedJobs.add(entry.jobId);
        } else {
          report.unknown++;
          if (result.error) errors.push(`${result.externalId}: ${result.error}`);
        }
      }
    }
    // Une offre n'est retirée que si plus aucune source active ne la porte.
    for (const jobId of touchedJobs) {
      const alive = await prisma.jobSourceEntry.count({
        where: { jobId, status: { in: ["ACTIVE", "UNKNOWN"] } },
      });
      if (alive === 0)
        await prisma.job.update({
          where: { id: jobId },
          data: { verificationStatus: "REMOVED", isActive: false, lastVerifiedAt: now() },
        });
      else await refreshCanonicalApplication(jobId);
    }
    report.durationMs = now().getTime() - startedAt.getTime();
    await finishRun(run.id, {
      status: errors.length ? "PARTIAL" : "SUCCESS",
      startedAt,
      now: now(),
      errors,
      counters: {
        fetchedCount: report.checked,
        updatedCount: report.active,
        expiredCount: report.removed,
        failedCount: report.unknown,
      },
    });
    log.info("Vérification terminée", {
      provider: provider.key,
      operation: "verify",
      status: "ok",
      durationMs: report.durationMs,
      checked: report.checked,
      active: report.active,
      removed: report.removed,
      unknown: report.unknown,
    });
  } catch (error) {
    report.durationMs = now().getTime() - startedAt.getTime();
    errors.push(error instanceof Error ? error.message : String(error));
    await finishRun(run.id, {
      status: "ERROR",
      startedAt,
      now: now(),
      errors,
      counters: {
        fetchedCount: report.checked,
        updatedCount: report.active,
        expiredCount: report.removed,
        failedCount: report.unknown,
      },
    });
    log.error("Vérification échouée", error, {
      provider: provider.key,
      operation: "verify",
      status: "error",
    });
  }
  return report;
}

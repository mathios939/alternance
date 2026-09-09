import "server-only";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
import { findCity } from "@/config/cities";
import { normalizeCompanyName } from "@/lib/text/normalize";
import { findCanonical, type DedupeCandidate } from "./dedupe";
import { normalizeJob } from "./normalize";
import type { IngestReport, JobSourceProvider, NormalizedJob } from "./types";

const log = createLogger("job-sources:ingest");

async function upsertCompany(job: NormalizedJob): Promise<string> {
  const normalized = normalizeCompanyName(job.companyName);
  const existing = await prisma.company.findFirst({ where: { OR: [{ slug: slugify(job.companyName) }, { name: { equals: job.companyName, mode: "insensitive" } }] }, select: { id: true, name: true } });
  if (existing) return existing.id;
  const city = findCity(job.city);
  const created = await prisma.company.create({
    data: {
      name: job.companyName,
      slug: `${slugify(job.companyName) || normalized.replace(/\s+/g, "-") || "entreprise"}-${Date.now().toString(36)}`,
      sector: job.sector,
      size: "PME",
      website: job.companyWebsite,
      city: city?.name ?? job.city,
      postalCode: city?.postalCode ?? job.postalCode,
      department: city?.department ?? job.department,
      region: city?.region ?? job.region,
      latitude: city?.lat ?? job.latitude,
      longitude: city?.lng ?? job.longitude,
      jobFamilies: [job.jobFamily],
      isHiring: true,
      hiresApprentices: true,
      dataOrigin: job.isDemo ? "DEMO" : "REAL",
      isDemo: job.isDemo,
      lastActivityAt: job.publishedAt,
    },
  });
  return created.id;
}

/**
 * Ingestion : récupère, normalise, dédoublonne et enregistre les offres d'un provider.
 * Une offre déjà connue (même externalId) est mise à jour ; un doublon d'une autre source
 * est rattaché à sa version canonique tout en conservant sa source.
 */
export async function ingestFromProvider(provider: JobSourceProvider, params: { keywords?: string; city?: string; limit?: number } = {}): Promise<IngestReport> {
  const report: IngestReport = { sourceKey: provider.key, fetched: 0, created: 0, updated: 0, duplicates: 0, skipped: 0, errors: [] };
  const status = await provider.status();
  const source = await prisma.jobSource.upsert({ where: { key: provider.key }, update: {}, create: { key: provider.key, name: provider.name, type: provider.type, isEnabled: status.configured } });
  if (!status.configured) {
    await prisma.jobSource.update({ where: { id: source.id }, data: { lastSyncStatus: "DISABLED", lastSyncError: status.reason ?? "Non configuré" } });
    report.errors.push(status.reason ?? "Provider non configuré");
    return report;
  }
  await prisma.jobSource.update({ where: { id: source.id }, data: { lastSyncStatus: "RUNNING", lastSyncError: null } });
  try {
    const raws = await provider.fetchJobs(params);
    report.fetched = raws.length;
    const recent: DedupeCandidate[] = (await prisma.job.findMany({ where: { isActive: true, canonicalJobId: null, publishedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, include: { company: { select: { name: true } } }, take: 5000 })).map((j) => ({ id: j.id, title: j.title, companyName: j.company.name, city: j.city, description: j.description, sourceUrl: j.sourceUrl, publishedAt: j.publishedAt }));

    for (const raw of raws) {
      try {
        const job = normalizeJob(raw, { key: provider.key, type: provider.type, isDemo: false });
        if (!job.title || !job.description) {
          report.skipped++;
          continue;
        }
        const existingEntry = await prisma.jobSourceEntry.findUnique({ where: { sourceId_externalId: { sourceId: source.id, externalId: job.externalId } } });
        if (existingEntry) {
          await prisma.job.update({ where: { id: existingEntry.jobId }, data: { title: job.title, description: job.description, expiresAt: job.expiresAt, isActive: true, updatedAt: new Date() } });
          await prisma.jobSourceEntry.update({ where: { id: existingEntry.id }, data: { lastSeenAt: new Date(), rawPayload: job.raw as never } });
          report.updated++;
          continue;
        }
        const canonical = findCanonical({ id: "new", title: job.title, companyName: job.companyName, city: job.city, description: job.description, sourceUrl: job.sourceUrl, publishedAt: job.publishedAt }, recent);
        const companyId = await upsertCompany(job);
        const skills = await prisma.skill.findMany({ where: { slug: { in: job.skillSlugs } }, select: { id: true } });
        const created = await prisma.job.create({
          data: {
            slug: `${job.slugBase}-${Date.now().toString(36)}`,
            title: job.title,
            companyId,
            description: job.description,
            missions: job.missions,
            requirements: job.requirements,
            benefits: job.benefits,
            skillsText: job.skillsText,
            city: job.city,
            postalCode: job.postalCode,
            department: job.department,
            region: job.region,
            latitude: job.latitude,
            longitude: job.longitude,
            contractType: job.contractType,
            educationLevelMin: job.educationLevelMin,
            educationLevelMax: job.educationLevelMax,
            durationMonths: job.durationMonths,
            rhythm: job.rhythm,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            remote: job.remote,
            startDate: job.startDate,
            jobFamily: job.jobFamily,
            sector: job.sector,
            publishedAt: job.publishedAt,
            expiresAt: job.expiresAt,
            source: job.source,
            sourceUrl: job.sourceUrl,
            applicationUrl: job.applicationUrl,
            isDemo: false,
            dataOrigin: "REAL",
            canonicalJobId: canonical?.match.id ?? null,
            duplicateConfidence: canonical?.verdict.confidence ?? null,
            skills: { create: skills.map((s, i) => ({ skillId: s.id, required: i < 3 })) },
            sourceEntries: { create: { sourceId: source.id, externalId: job.externalId, url: job.sourceUrl, rawPayload: job.raw as never } },
          },
        });
        if (canonical) report.duplicates++;
        else {
          report.created++;
          recent.push({ id: created.id, title: job.title, companyName: job.companyName, city: job.city, description: job.description, sourceUrl: job.sourceUrl, publishedAt: job.publishedAt });
        }
      } catch (error) {
        report.errors.push(`${raw.externalId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await prisma.jobSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date(), lastSyncStatus: report.errors.length && !report.created && !report.updated ? "ERROR" : "SUCCESS", lastSyncError: report.errors[0] ?? null, jobsCount: { increment: report.created } } });
    log.info("Ingestion terminée", { ...report, errors: report.errors.length });
  } catch (error) {
    log.error("Ingestion échouée", error, { source: provider.key });
    await prisma.jobSource.update({ where: { id: source.id }, data: { lastSyncStatus: "ERROR", lastSyncError: error instanceof Error ? error.message : String(error) } });
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  return report;
}

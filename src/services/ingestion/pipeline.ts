import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { normalizeText } from "@/lib/text/normalize";
import {
  calculateDuplicateConfidence,
  type DedupeCandidate,
  type DuplicateVerdict,
} from "@/services/job-sources/dedupe";
import { normalizeJob, UNKNOWN_EMPLOYER_NAME } from "@/services/job-sources/normalize";
import type {
  FetchParams,
  IngestReport,
  JobSourceProvider,
  NormalizedJob,
  ProviderStatus,
  RawJob,
} from "@/services/job-sources/types";
import { findOrCreateCompanyForJob, type CompanyMatch } from "./company-match";
import { upsertJobPostingContact } from "./contacts";
import { calculateJobDataQuality } from "./quality";
import { finishRun, startRun } from "./runs";
import { validateRawJob, type RejectCode } from "./validate";

/**
 * ─────────────────────────────────────────────────────────────
 * PIPELINE D'INGESTION (Phase 3, mis à l'échelle en Phase 30)
 *   SOURCE → FETCH → VALIDATION → NORMALIZATION → DEDUPLICATION → ENRICHMENT → DATABASE
 * Chaque exécution est journalisée dans IngestionRun (compteurs + erreurs).
 * Une source non configurée est journalisée SKIPPED et ne bascule jamais en simulation.
 *
 * À l'échelle nationale (dizaines de milliers d'offres par passage) :
 *   • les entrées existantes sont retrouvées en une requête par lot, pas une par offre ;
 *   • une offre dont la source n'a pas changé la date d'actualisation est seulement pointée
 *     (vue, vérifiée) sans être réécrite ;
 *   • les rapprochements d'entreprise sont mémorisés pendant l'exécution ;
 *   • l'index de dédoublonnage est restreint aux départements du lot.
 * ─────────────────────────────────────────────────────────────
 */
const log = createLogger("ingestion:pipeline");

export type RunIngestionOptions = {
  provider: JobSourceProvider;
  params?: FetchParams;
  trigger?: string;
  now?: () => Date;
  /** Nombre max d'offres traitées (après récupération). */
  maxJobs?: number;
  /** Réécrit aussi les offres dont la source n'a pas changé (après une évolution de la normalisation). */
  forceRewrite?: boolean;
};

const DEDUPE_WINDOW_DAYS = 120;
const LOOKUP_CHUNK = 500;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

/** Index en mémoire des offres récentes, interrogé par ville et par entreprise (évite un produit cartésien). */
class DedupeIndex {
  private byCity = new Map<string, DedupeCandidate[]>();
  private byCompany = new Map<string, DedupeCandidate[]>();
  size = 0;

  add(c: DedupeCandidate) {
    const city = normalizeText(c.city);
    const company = normalizeText(c.companyName);
    if (city) this.byCity.set(city, [...(this.byCity.get(city) ?? []), c]);
    if (company && company !== normalizeText(UNKNOWN_EMPLOYER_NAME))
      this.byCompany.set(company, [...(this.byCompany.get(company) ?? []), c]);
    this.size++;
  }

  find(candidate: DedupeCandidate): { match: DedupeCandidate; verdict: DuplicateVerdict } | null {
    const pool = new Map<string, DedupeCandidate>();
    for (const c of this.byCity.get(normalizeText(candidate.city)) ?? []) pool.set(c.id, c);
    for (const c of this.byCompany.get(normalizeText(candidate.companyName)) ?? [])
      pool.set(c.id, c);
    let best: { match: DedupeCandidate; verdict: DuplicateVerdict } | null = null;
    for (const other of pool.values()) {
      const verdict = calculateDuplicateConfidence(candidate, other);
      if (verdict.level !== "distinct" && (!best || verdict.confidence > best.verdict.confidence))
        best = { match: other, verdict };
    }
    return best;
  }
}

/**
 * Index de dédoublonnage restreint aux départements du lot : un doublon inter-sources exige la même
 * ville ou le même code postal pour atteindre le seuil automatique, un candidat d'un autre
 * département ne peut donc jamais être rattaché. Sans département connu, l'index reste global.
 */
async function loadDedupeIndex(now: Date, departments: string[]): Promise<DedupeIndex> {
  const scoped = departments.length > 0 && departments.length <= 12;
  const rows = await prisma.job.findMany({
    where: {
      isDemo: false,
      isActive: true,
      canonicalJobId: null,
      publishedAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_DAYS * 86_400_000) },
      ...(scoped ? { OR: [{ department: { in: departments } }, { department: null }] } : {}),
    },
    select: {
      id: true,
      title: true,
      normalizedTitle: true,
      city: true,
      postalCode: true,
      description: true,
      sourceUrl: true,
      applicationUrl: true,
      publishedAt: true,
      company: { select: { name: true } },
      sourceEntries: {
        select: { source: { select: { key: true } } },
        orderBy: { isPrimary: "desc" },
        take: 1,
      },
    },
    take: 20_000,
  });
  const index = new DedupeIndex();
  for (const r of rows)
    index.add({
      id: r.id,
      title: r.title,
      normalizedTitle: r.normalizedTitle,
      companyName: r.company.name,
      city: r.city,
      postalCode: r.postalCode,
      description: r.description,
      sourceUrl: r.sourceUrl,
      applicationUrl: r.applicationUrl,
      publishedAt: r.publishedAt,
      sourceKey: r.sourceEntries[0]?.source.key ?? null,
    });
  return index;
}

function toCandidate(job: NormalizedJob, id = "new"): DedupeCandidate {
  return {
    id,
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    companyName: job.companyName,
    city: job.city,
    postalCode: job.postalCode,
    description: job.description,
    sourceUrl: job.sourceUrl,
    applicationUrl: job.applicationUrl,
    publishedAt: job.publishedAt,
    sourceKey: job.sourceKey,
    externalId: job.externalId,
  };
}

function qualityFor(job: NormalizedJob, now: Date): number {
  return calculateJobDataQuality(
    {
      title: job.title,
      description: job.description,
      companyKnown: Boolean(job.companyNameRaw),
      city: job.city,
      hasCoordinates: job.latitude !== null && job.longitude !== null,
      applicationUrl: job.applicationUrl,
      sourceKnown: true,
      publishedAt: job.publishedAt,
      lastVerifiedAt: now,
      educationLevelKnown: job.educationLevelMin !== null || job.educationLevelMax !== null,
      salaryKnown: job.salaryMin !== null,
      durationKnown: job.durationMonths !== null,
      skillsCount: job.skillsText.length,
    },
    now,
  ).score;
}

async function upsertSource(provider: JobSourceProvider, status: ProviderStatus) {
  return prisma.jobSource.upsert({
    where: { key: provider.key },
    update: {
      name: provider.name,
      type: provider.type,
      priority: provider.priority,
      capabilities: provider.capabilities as unknown as Prisma.InputJsonValue,
    },
    create: {
      key: provider.key,
      name: provider.name,
      type: provider.type,
      isEnabled: status.configured,
      priority: provider.priority,
      capabilities: provider.capabilities as unknown as Prisma.InputJsonValue,
    },
  });
}

function jobColumns(job: NormalizedJob, now: Date) {
  return {
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    companyNameRaw: job.companyNameRaw,
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
    salaryPeriod: job.salaryPeriod,
    remote: job.remote,
    startDate: job.startDate,
    jobFamily: job.jobFamily,
    sector: job.sector,
    romeCode: job.romeCode,
    nafCode: job.nafCode,
    positionsCount: job.positionsCount,
    publishedAt: job.publishedAt,
    sourceUpdatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    source: job.source,
    sourceUrl: job.sourceUrl,
    applicationUrl: job.applicationUrl,
    applicationEmail: job.applicationEmail,
    applicationLabel: job.applicationLabel,
    isActive: true,
    isDemo: false,
    dataOrigin: "REAL" as const,
    verificationStatus: "ACTIVE" as const,
    lastVerifiedAt: now,
    dataQualityScore: qualityFor(job, now),
  };
}

function entryColumns(job: NormalizedJob, now: Date) {
  return {
    url: job.sourceUrl,
    applicationUrl: job.applicationUrl,
    applicationEmail: job.applicationEmail,
    applicationLabel: job.applicationLabel,
    rawPayload:
      job.raw === null || job.raw === undefined
        ? Prisma.JsonNull
        : (job.raw as Prisma.InputJsonValue),
    publishedAt: job.publishedAt,
    sourceUpdatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    status: "ACTIVE" as const,
    lastVerifiedAt: now,
    lastSeenAt: now,
    missedListings: 0,
  };
}

/** Choisit l'URL de candidature parmi les sources d'une offre : page carrière > source officielle > agrégateur. */
export async function refreshCanonicalApplication(jobId: string): Promise<void> {
  const entries = await prisma.jobSourceEntry.findMany({
    where: { jobId, status: { in: ["ACTIVE", "UNKNOWN"] } },
    include: { source: { select: { priority: true } } },
    orderBy: { firstSeenAt: "asc" },
  });
  if (entries.length === 0) return;
  const best = [...entries].sort((a, b) => b.source.priority - a.source.priority)[0]!;
  await prisma.$transaction([
    prisma.jobSourceEntry.updateMany({ where: { jobId }, data: { isPrimary: false } }),
    prisma.jobSourceEntry.update({ where: { id: best.id }, data: { isPrimary: true } }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        applicationUrl: best.applicationUrl ?? best.url ?? undefined,
        applicationEmail: best.applicationEmail ?? undefined,
        applicationLabel: best.applicationLabel ?? undefined,
      },
    }),
  ]);
}

type ExistingEntry = { id: string; jobId: string; sourceUpdatedAt: Date | null };

/** Entrées déjà connues pour ce lot (une requête par tranche de 500 identifiants). */
async function loadExistingEntries(
  sourceId: string,
  raws: RawJob[],
): Promise<Map<string, ExistingEntry>> {
  const ids = Array.from(
    new Set(raws.map((r) => r.externalId).filter((id): id is string => Boolean(id))),
  );
  const map = new Map<string, ExistingEntry>();
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const rows = await prisma.jobSourceEntry.findMany({
      where: { sourceId, externalId: { in: ids.slice(i, i + LOOKUP_CHUNK) } },
      select: { id: true, jobId: true, externalId: true, sourceUpdatedAt: true },
    });
    for (const row of rows)
      map.set(row.externalId, {
        id: row.id,
        jobId: row.jobId,
        sourceUpdatedAt: row.sourceUpdatedAt,
      });
  }
  return map;
}

/** Pointage groupé des offres inchangées : vues, vérifiées, réactivées si besoin — sans réécriture. */
async function touchUnchanged(entries: ExistingEntry[], now: Date): Promise<void> {
  for (let i = 0; i < entries.length; i += LOOKUP_CHUNK) {
    const chunk = entries.slice(i, i + LOOKUP_CHUNK);
    await prisma.$transaction([
      prisma.jobSourceEntry.updateMany({
        where: { id: { in: chunk.map((e) => e.id) } },
        data: { status: "ACTIVE", lastSeenAt: now, lastVerifiedAt: now, missedListings: 0 },
      }),
      prisma.job.updateMany({
        where: { id: { in: chunk.map((e) => e.jobId) } },
        data: { verificationStatus: "ACTIVE", lastVerifiedAt: now, isActive: true },
      }),
    ]);
  }
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return Boolean(a && b) && a!.getTime() === b!.getTime();
}

export function emptyReport(sourceKey: string): IngestReport {
  return {
    sourceKey,
    runId: null,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    errors: [],
    warnings: [],
    durationMs: 0,
    total: null,
    requests: 0,
    truncated: false,
  };
}

export async function runIngestion(options: RunIngestionOptions): Promise<IngestReport> {
  const { provider, params = {}, trigger = "manual" } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const report = emptyReport(provider.key);

  const status = await provider.status();
  const source = await upsertSource(provider, status);
  if (!status.configured) {
    const reason = status.reason ?? "Provider non configuré";
    const run = await startRun({
      sourceKey: provider.key,
      sourceId: source.id,
      trigger,
      params,
      status: "SKIPPED",
      errorSummary: reason,
    });
    await prisma.jobSource.update({
      where: { id: source.id },
      data: { lastSyncStatus: "DISABLED", lastSyncError: reason },
    });
    report.runId = run.id;
    report.errors.push(reason);
    report.durationMs = now().getTime() - startedAt.getTime();
    log.warn("Ingestion ignorée : provider non configuré", {
      provider: provider.key,
      operation: "ingest",
      status: "skipped",
      missing: status.missing,
    });
    return report;
  }

  const run = await startRun({ sourceKey: provider.key, sourceId: source.id, trigger, params });
  report.runId = run.id;
  await prisma.jobSource.update({
    where: { id: source.id },
    data: { lastSyncStatus: "RUNNING", lastSyncError: null },
  });
  log.info("Ingestion démarrée", {
    provider: provider.key,
    operation: "ingest",
    runId: run.id,
    trigger,
    params,
  });

  const rejectedBy: Partial<Record<RejectCode, number>> = {};
  let probable = 0;
  let sameSourceProbable = 0;
  let companiesCreated = 0;
  let contactsCreated = 0;

  try {
    // FETCH
    const fetchStarted = Date.now();
    const page = await provider.fetchJobs(params);
    report.fetched = page.jobs.length;
    report.total = page.total;
    report.requests = page.requests;
    report.truncated = page.truncated ?? false;
    report.warnings.push(...page.warnings);
    log.info("Récupération terminée", {
      provider: provider.key,
      operation: "fetch",
      durationMs: Date.now() - fetchStarted,
      status: "ok",
      count: page.jobs.length,
      total: page.total,
      requests: page.requests,
      truncated: report.truncated,
    });

    const jobs = options.maxJobs ? page.jobs.slice(0, options.maxJobs) : page.jobs;
    const departments = Array.from(
      new Set(jobs.map((j) => j.department).filter((d): d is string => Boolean(d))),
    );
    const [index, skillRows, existing] = await Promise.all([
      loadDedupeIndex(now(), departments),
      prisma.skill.findMany({ select: { id: true, slug: true } }),
      loadExistingEntries(source.id, jobs),
    ]);
    const skillIdBySlug = new Map(skillRows.map((s) => [s.slug, s.id]));
    const companyCache = new Map<string, CompanyMatch>();
    const unchanged: ExistingEntry[] = [];

    for (const raw of jobs) {
      try {
        // VALIDATION
        const validation = validateRawJob(raw, { now: now() });
        if (!validation.ok) {
          report.rejected++;
          rejectedBy[validation.code] = (rejectedBy[validation.code] ?? 0) + 1;
          continue;
        }
        // NORMALIZATION
        const job = normalizeJob(raw, { key: provider.key, type: provider.type, isDemo: false });
        const ts = now();

        // DEDUPLICATION 1 : même source, même identifiant → pointage si inchangée, sinon mise à jour
        const existingEntry = existing.get(job.externalId);
        if (existingEntry) {
          if (!options.forceRewrite && sameInstant(existingEntry.sourceUpdatedAt, job.updatedAt)) {
            unchanged.push(existingEntry);
            report.unchanged++;
          } else {
            await prisma.$transaction([
              prisma.jobSourceEntry.update({
                where: { id: existingEntry.id },
                data: entryColumns(job, ts),
              }),
              prisma.job.update({
                where: { id: existingEntry.jobId },
                data: { ...jobColumns(job, ts), companyNameRaw: job.companyNameRaw },
              }),
            ]);
          }
          report.updated++;
          continue;
        }

        // DEDUPLICATION 2 : même offre venue d'une autre source → rattachement à l'offre canonique.
        // Un doublon seulement « probable » entre deux offres de la MÊME source (identifiants distincts)
        // est traité comme une offre distincte : la source lui a attribué son propre identifiant
        // (employeur publiant plusieurs postes proches). Constaté sur les données réelles France Travail.
        let match = index.find(toCandidate(job));
        if (match && match.verdict.level === "probable" && match.match.sourceKey === provider.key) {
          sameSourceProbable++;
          match = null;
        }
        if (match && match.verdict.level === "duplicate") {
          await prisma.jobSourceEntry.create({
            data: {
              jobId: match.match.id,
              sourceId: source.id,
              externalId: job.externalId,
              duplicateConfidence: match.verdict.confidence,
              ...entryColumns(job, ts),
            },
          });
          await prisma.job.update({
            where: { id: match.match.id },
            data: { isActive: true, verificationStatus: "ACTIVE", lastVerifiedAt: ts },
          });
          await refreshCanonicalApplication(match.match.id);
          report.duplicates++;
          continue;
        }

        // ENRICHMENT : entreprise (mémorisée pendant l'exécution), compétences, qualité, contact publié
        const companyKey = `${job.companyNameNormalized}|${job.department ?? ""}`;
        let company = companyCache.get(companyKey);
        if (!company) {
          company = await findOrCreateCompanyForJob(job, {
            sourceKey: provider.key,
            sourceLabel: provider.name,
            now: ts,
          });
          companyCache.set(companyKey, { ...company, created: false });
          if (company.created) companiesCreated++;
        }
        const skillIds = job.skillSlugs
          .map((slug) => skillIdBySlug.get(slug))
          .filter((id): id is string => Boolean(id));

        // DATABASE
        const created = await prisma.job.create({
          data: {
            slug: `${job.slugBase}-${uniqueSuffix()}`,
            companyId: company.id,
            ...jobColumns(job, ts),
            canonicalJobId: match ? match.match.id : null,
            duplicateConfidence: match ? Math.round(match.verdict.confidence * 100) : null,
            skills: { create: skillIds.map((skillId, i) => ({ skillId, required: i < 3 })) },
            sourceEntries: {
              create: {
                sourceId: source.id,
                externalId: job.externalId,
                isPrimary: true,
                ...entryColumns(job, ts),
              },
            },
          },
          select: { id: true },
        });
        existing.set(job.externalId, { id: "", jobId: created.id, sourceUpdatedAt: job.updatedAt });
        if (match) {
          probable++;
          report.duplicates++;
        } else {
          report.created++;
          index.add(toCandidate(job, created.id));
        }
        if (
          await upsertJobPostingContact(job, {
            jobId: created.id,
            companyId: company.id,
            sourceLabel: provider.name,
            now: ts,
            companyName: job.companyNameRaw,
            isPlaceholderCompany: company.matchedBy === "placeholder",
          })
        )
          contactsCreated++;
      } catch (error) {
        report.failed++;
        const message = error instanceof Error ? error.message : String(error);
        report.errors.push(`${raw.externalId}: ${message}`);
        log.error("Offre non enregistrée", error, {
          provider: provider.key,
          externalId: raw.externalId,
        });
      }
    }

    if (unchanged.length) await touchUnchanged(unchanged, now());

    if (Object.keys(rejectedBy).length)
      report.warnings.push(
        `Rejets : ${Object.entries(rejectedBy)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      );
    if (probable)
      report.warnings.push(
        `${probable} doublon(s) probable(s) inter-sources créé(s) masqué(s), à vérifier dans l'admin.`,
      );
    if (sameSourceProbable)
      report.warnings.push(
        `${sameSourceProbable} offre(s) proche(s) d'une autre offre de la même source conservée(s) distincte(s).`,
      );

    const runStatus = report.failed > 0 || report.errors.length > 0 ? "PARTIAL" : "SUCCESS";
    report.durationMs = now().getTime() - startedAt.getTime();
    await finishRun(run.id, {
      status: runStatus,
      startedAt,
      now: now(),
      errors: report.errors,
      counters: {
        fetchedCount: report.fetched,
        createdCount: report.created,
        updatedCount: report.updated,
        duplicateCount: report.duplicates,
        rejectedCount: report.rejected,
        failedCount: report.failed,
      },
    });
    await prisma.jobSource.update({
      where: { id: source.id },
      data: {
        lastSyncAt: now(),
        lastSyncStatus: runStatus === "SUCCESS" ? "SUCCESS" : "ERROR",
        lastSyncError: report.errors[0] ?? null,
        jobsCount: { increment: report.created },
      },
    });
    log.info("Ingestion terminée", {
      provider: provider.key,
      operation: "ingest",
      status: runStatus.toLowerCase(),
      durationMs: report.durationMs,
      fetched: report.fetched,
      created: report.created,
      updated: report.updated,
      unchanged: report.unchanged,
      duplicates: report.duplicates,
      probable,
      sameSourceProbable,
      rejected: report.rejected,
      failed: report.failed,
      companiesCreated,
      contactsCreated,
      warnings: report.warnings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(message);
    report.durationMs = now().getTime() - startedAt.getTime();
    await finishRun(run.id, {
      status: "ERROR",
      startedAt,
      now: now(),
      errors: report.errors,
      counters: {
        fetchedCount: report.fetched,
        createdCount: report.created,
        updatedCount: report.updated,
        duplicateCount: report.duplicates,
        rejectedCount: report.rejected,
        failedCount: report.failed,
      },
    });
    await prisma.jobSource.update({
      where: { id: source.id },
      data: { lastSyncStatus: "ERROR", lastSyncError: message },
    });
    log.error("Ingestion échouée", error, {
      provider: provider.key,
      operation: "ingest",
      status: "error",
      errorCode: (error as { code?: string })?.code,
    });
  }
  return report;
}

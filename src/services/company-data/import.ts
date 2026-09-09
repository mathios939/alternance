import { Prisma } from "@/generated/prisma/client";
import { findDepartmentByCode } from "@/config/departments";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { normalizeCompanyName } from "@/lib/text/normalize";
import { slugify } from "@/lib/utils";
import { mergeDataSources } from "@/services/ingestion/data-sources";
import { finishRun, startRun } from "@/services/ingestion/runs";
import { nafMapping, sizeFromCategory } from "./naf";
import type { CompanyDataProvider, CompanyRecord, CompanySearchParams } from "./types";

/**
 * IMPORT D'ENTREPRISES RÉELLES (Phase 9) : ciblé (départements + codes NAF), jamais massif.
 * Une entreprise déjà connue (SIREN, ou nom normalisé + département) est enrichie, pas dupliquée.
 * Ce qui n'est pas fourni par la source reste null (site web, description…).
 */
const log = createLogger("company-data:import");

export type CompanyImportReport = { runId: string | null; fetched: number; created: number; updated: number; skipped: number; failed: number; errors: string[]; warnings: string[]; durationMs: number };

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base).slice(0, 80) || "entreprise";
  const existing = new Set((await prisma.company.findMany({ where: { slug: { startsWith: root } }, select: { slug: true } })).map((c) => c.slug));
  if (!existing.has(root)) return root;
  for (let i = 2; i < 500; i++) if (!existing.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now().toString(36)}`;
}

/** Colonnes Company dérivées d'une fiche officielle. Taille = REAL si la tranche d'effectif est connue. */
export function companyColumnsFromRecord(record: CompanyRecord, sourceKey: string, now: Date) {
  const dep = findDepartmentByCode(record.departmentCode);
  const naf = nafMapping(record.nafCode);
  const size = sizeFromCategory(record.category, record.employeeRange);
  const displayName = record.brandName && record.brandName.length >= 3 ? record.brandName : record.legalName;
  return {
    name: displayName,
    nameNormalized: normalizeCompanyName(displayName),
    legalName: record.legalName,
    brandName: record.brandName,
    siren: record.siren,
    siret: record.siret,
    nafCode: record.nafCode,
    nafLabel: record.nafLabel ?? naf?.label ?? null,
    legalCategory: record.legalCategory,
    employeeRange: record.employeeRange,
    employeeRangeLabel: record.employeeRangeLabel,
    headcount: record.headcountEstimate,
    registeredAt: record.registeredAt,
    address: record.address,
    city: record.city ?? "France",
    postalCode: record.postalCode,
    department: dep?.name ?? null,
    region: dep?.region ?? null,
    latitude: record.latitude,
    longitude: record.longitude,
    sector: naf?.sector ?? "other",
    size: size ?? ("PME" as const),
    sizeOrigin: size ? ("REAL" as const) : ("UNKNOWN" as const),
    website: record.website,
    dataOrigin: "REAL" as const,
    isDemo: false,
    isPlaceholder: false,
    lastVerifiedAt: now,
    dataSourceRef: { source: sourceKey, url: record.sourceUrl, fetchedAt: now.toISOString(), label: "Annuaire des entreprises (SIRENE)" },
    jobFamilies: naf?.jobFamilies ?? [],
  };
}

export async function upsertCompanyRecord(record: CompanyRecord, provider: CompanyDataProvider, now = new Date()): Promise<"created" | "updated" | "skipped"> {
  if (!record.isActive) return "skipped";
  const cols = companyColumnsFromRecord(record, provider.key, now);
  const { dataSourceRef, jobFamilies, ...data } = cols;
  const existing =
    (await prisma.company.findFirst({ where: { siren: record.siren }, select: { id: true, dataSources: true, jobFamilies: true, website: true, description: true, isDemo: true } })) ??
    (await prisma.company.findFirst({ where: { siren: null, isDemo: false, isPlaceholder: false, nameNormalized: cols.nameNormalized, ...(cols.department ? { department: cols.department } : {}) }, select: { id: true, dataSources: true, jobFamilies: true, website: true, description: true, isDemo: true } }));
  if (existing) {
    if (existing.isDemo) return "skipped";
    await prisma.company.update({
      where: { id: existing.id },
      data: {
        ...data,
        website: existing.website ?? data.website,
        jobFamilies: Array.from(new Set([...existing.jobFamilies, ...jobFamilies])),
        dataSources: mergeDataSources(existing.dataSources, dataSourceRef) as unknown as Prisma.InputJsonValue,
      },
    });
    return "updated";
  }
  await prisma.company.create({
    data: { ...data, slug: await uniqueSlug(cols.name), jobFamilies, technologies: [], hiresApprentices: false, isHiring: false, dataSources: [dataSourceRef] as unknown as Prisma.InputJsonValue },
  });
  return "created";
}

export type CompanyImportOptions = {
  provider: CompanyDataProvider;
  params: CompanySearchParams;
  /** Nombre max de fiches importées pour cet appel (borne de sécurité). */
  maxRecords?: number;
  trigger?: string;
  now?: () => Date;
};

export async function importCompanies(options: CompanyImportOptions): Promise<CompanyImportReport> {
  const { provider, params, maxRecords = 200, trigger = "manual" } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const report: CompanyImportReport = { runId: null, fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0, errors: [], warnings: [], durationMs: 0 };
  const status = await provider.status();
  if (!status.configured) {
    report.errors.push(status.reason ?? "Provider non configuré");
    const run = await startRun({ sourceKey: `companies:${provider.key}`, trigger, params, status: "SKIPPED", errorSummary: status.reason });
    report.runId = run.id;
    return report;
  }
  const run = await startRun({ sourceKey: `companies:${provider.key}`, trigger, params: { ...params, maxRecords } });
  report.runId = run.id;
  try {
    let page = params.page ?? 1;
    while (report.fetched < maxRecords) {
      const result = await provider.search({ ...params, page, perPage: Math.min(25, maxRecords - report.fetched) });
      report.warnings.push(...result.warnings);
      if (result.results.length === 0) break;
      for (const record of result.results) {
        report.fetched++;
        try {
          const outcome = await upsertCompanyRecord(record, provider, now());
          if (outcome === "created") report.created++;
          else if (outcome === "updated") report.updated++;
          else report.skipped++;
        } catch (error) {
          report.failed++;
          report.errors.push(`${record.siren}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (result.totalPages !== null && page >= result.totalPages) break;
      page++;
    }
    report.durationMs = now().getTime() - startedAt.getTime();
    await finishRun(run.id, { status: report.failed ? "PARTIAL" : "SUCCESS", startedAt, now: now(), errors: report.errors, counters: { fetchedCount: report.fetched, createdCount: report.created, updatedCount: report.updated, rejectedCount: report.skipped, failedCount: report.failed } });
    log.info("Import entreprises terminé", { provider: provider.key, operation: "import", status: "ok", durationMs: report.durationMs, fetched: report.fetched, created: report.created, updated: report.updated, skipped: report.skipped, failed: report.failed });
  } catch (error) {
    report.durationMs = now().getTime() - startedAt.getTime();
    report.errors.push(error instanceof Error ? error.message : String(error));
    await finishRun(run.id, { status: "ERROR", startedAt, now: now(), errors: report.errors, counters: { fetchedCount: report.fetched, createdCount: report.created, updatedCount: report.updated, failedCount: report.failed } });
    log.error("Import entreprises échoué", error, { provider: provider.key, operation: "import", status: "error" });
  }
  return report;
}

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

/**
 * Site retenu pour localiser l'entreprise : un établissement du département recherché si le siège
 * est ailleurs (Capgemini a un site à Nantes mais son siège en Île-de-France), sinon le siège.
 */
export function pickSite(record: CompanyRecord, preferredDepartments: string[] = []): { city: string | null; postalCode: string | null; departmentCode: string | null; latitude: number | null; longitude: number | null; address: string | null; siret: string | null; fromEstablishment: boolean } {
  const local = preferredDepartments.length ? record.establishments.find((e) => e.departmentCode && preferredDepartments.includes(e.departmentCode)) : undefined;
  if (local && (!record.departmentCode || !preferredDepartments.includes(record.departmentCode))) {
    return { city: local.city, postalCode: local.postalCode, departmentCode: local.departmentCode, latitude: local.latitude, longitude: local.longitude, address: local.address, siret: local.siret, fromEstablishment: true };
  }
  return { city: record.city, postalCode: record.postalCode, departmentCode: record.departmentCode, latitude: record.latitude, longitude: record.longitude, address: record.address, siret: record.siret, fromEstablishment: false };
}

/** Colonnes Company dérivées d'une fiche officielle. Taille = REAL si la tranche d'effectif est connue. */
export function companyColumnsFromRecord(record: CompanyRecord, sourceKey: string, now: Date, preferredDepartments: string[] = []) {
  const site = pickSite(record, preferredDepartments);
  const dep = findDepartmentByCode(site.departmentCode);
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
    address: site.address,
    city: site.city ?? "France",
    postalCode: site.postalCode,
    department: dep?.name ?? null,
    region: dep?.region ?? null,
    latitude: site.latitude,
    longitude: site.longitude,
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

/** Ajoute les établissements locaux comme implantations (une par ville / code postal, 5 max). */
async function upsertLocations(companyId: string, record: CompanyRecord, preferredDepartments: string[]): Promise<void> {
  const sites = record.establishments.filter((e) => e.city && (!preferredDepartments.length || (e.departmentCode && preferredDepartments.includes(e.departmentCode)))).slice(0, 5);
  if (sites.length === 0) return;
  const existing = await prisma.companyLocation.findMany({ where: { companyId }, select: { city: true, postalCode: true } });
  for (const site of sites) {
    if (existing.some((l) => l.city === site.city && (l.postalCode ?? null) === site.postalCode)) continue;
    const dep = findDepartmentByCode(site.departmentCode);
    await prisma.companyLocation.create({
      data: { companyId, label: site.isHeadquarters ? "Siège" : `Établissement ${site.city}`, address: site.address, city: site.city!, postalCode: site.postalCode, department: dep?.name ?? null, region: dep?.region ?? null, latitude: site.latitude, longitude: site.longitude, isHeadquarters: site.isHeadquarters },
    });
  }
}

export async function upsertCompanyRecord(record: CompanyRecord, provider: CompanyDataProvider, now = new Date(), preferredDepartments: string[] = []): Promise<"created" | "updated" | "skipped"> {
  if (!record.isActive) return "skipped";
  const cols = companyColumnsFromRecord(record, provider.key, now, preferredDepartments);
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
    await upsertLocations(existing.id, record, preferredDepartments);
    return "updated";
  }
  const created = await prisma.company.create({
    data: { ...data, slug: await uniqueSlug(cols.name), jobFamilies, technologies: [], hiresApprentices: false, isHiring: false, dataSources: [dataSourceRef] as unknown as Prisma.InputJsonValue },
    select: { id: true },
  });
  await upsertLocations(created.id, record, preferredDepartments);
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
          const outcome = await upsertCompanyRecord(record, provider, now(), params.departmentCodes ?? []);
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

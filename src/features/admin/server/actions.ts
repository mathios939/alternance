"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Plan, ReportStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { fail, ok, runAction, type ActionResult } from "@/lib/action";
import { assertRateLimit } from "@/lib/rate-limit";
import { getJobSourceProviders, type IngestReport } from "@/services/job-sources";

async function requireAdminId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session.id;
}

export async function setJobActive(jobId: string, isActive: boolean): Promise<ActionResult> {
  return runAction("admin.setJobActive", async () => {
    await requireAdminId();
    await prisma.job.update({ where: { id: jobId }, data: { isActive } });
    revalidatePath("/admin/jobs");
    return ok(undefined);
  });
}

export async function deleteJobAdmin(jobId: string): Promise<ActionResult> {
  return runAction("admin.deleteJob", async () => {
    await requireAdminId();
    await prisma.job.delete({ where: { id: jobId } });
    revalidatePath("/admin/jobs");
    return ok(undefined);
  });
}

export async function updateCompanyFlags(companyId: string, data: { hiresApprentices?: boolean; isHiring?: boolean }): Promise<ActionResult> {
  return runAction("admin.updateCompanyFlags", async () => {
    await requireAdminId();
    await prisma.company.update({ where: { id: companyId }, data });
    revalidatePath("/admin/companies");
    return ok(undefined);
  });
}

const userSchema = z.object({ role: z.enum(UserRole).optional(), plan: z.enum(Plan).optional() });

export async function updateUserAdmin(userId: string, input: z.input<typeof userSchema>): Promise<ActionResult> {
  return runAction("admin.updateUser", async () => {
    const adminId = await requireAdminId();
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) return fail("Valeurs invalides.");
    if (userId === adminId && parsed.data.role === "USER") return fail("Tu ne peux pas retirer ton propre rôle admin.");
    await prisma.user.update({ where: { id: userId }, data: parsed.data });
    revalidatePath("/admin/users");
    return ok(undefined);
  });
}

export async function resolveReport(reportId: string, status: ReportStatus): Promise<ActionResult> {
  return runAction("admin.resolveReport", async () => {
    await requireAdminId();
    const report = await prisma.report.update({ where: { id: reportId }, data: { status, resolvedAt: status === "OPEN" ? null : new Date() } });
    // Offre expirée confirmée → désactivation
    if (status === "RESOLVED" && report.reason === "JOB_EXPIRED" && report.jobId) {
      await prisma.job.update({ where: { id: report.jobId }, data: { isActive: false } });
    }
    revalidatePath("/admin/reports");
    return ok(undefined);
  });
}

/** Droit d'opposition : retire le contact des recommandations (conservé pour ne pas le réimporter). */
export async function optOutContact(contactId: string, optOut: boolean): Promise<ActionResult> {
  return runAction("admin.optOutContact", async () => {
    await requireAdminId();
    await prisma.contact.update({ where: { id: contactId }, data: { optOutAt: optOut ? new Date() : null } });
    revalidatePath("/admin/contacts");
    return ok(undefined);
  });
}

export async function deleteContactAdmin(contactId: string): Promise<ActionResult> {
  return runAction("admin.deleteContact", async () => {
    await requireAdminId();
    await prisma.contact.delete({ where: { id: contactId } });
    revalidatePath("/admin/contacts");
    return ok(undefined);
  });
}

export async function setSourceEnabled(sourceId: string, isEnabled: boolean): Promise<ActionResult> {
  return runAction("admin.setSourceEnabled", async () => {
    await requireAdminId();
    await prisma.jobSource.update({ where: { id: sourceId }, data: { isEnabled } });
    revalidatePath("/admin/sources");
    return ok(undefined);
  });
}

/** Lance une synchronisation manuelle d'une source (si configurée). Limitée à 3 lancements / 10 min. */
export async function syncSource(sourceKey: string): Promise<ActionResult<IngestReport>> {
  return runAction("admin.syncSource", async () => {
    const adminId = await requireAdminId();
    await assertRateLimit("admin:sync", adminId, { limit: 3, windowMs: 10 * 60_000 });
    const provider = getJobSourceProviders().find((p) => p.key === sourceKey);
    if (!provider) return fail("Source inconnue.");
    const { PRIORITY_DEPARTMENT_CODES } = await import("@/config/departments");
    const { runIngestion } = await import("@/services/ingestion");
    const status = await provider.status();
    if (!status.configured) return fail(status.reason ?? "Source non configurée.");
    // Un lancement admin cible le premier département prioritaire (borne de temps d'une action serveur).
    const report = await runIngestion({ provider, params: provider.capabilities.supportsLocation ? { department: PRIORITY_DEPARTMENT_CODES[0], publishedWithinDays: 7, limit: 600 } : { limit: 600 }, trigger: "admin" });
    revalidatePath("/admin/sources");
    revalidatePath("/admin/data");
    revalidatePath("/jobs");
    revalidatePath("/sources");
    if (report.errors.length && report.fetched === 0) return fail(report.errors[0] ?? "Ingestion échouée.");
    return ok(report);
  });
}

export async function verifySource(sourceKey: string): Promise<ActionResult<{ checked: number; active: number; removed: number; unknown: number }>> {
  return runAction("admin.verifySource", async () => {
    const adminId = await requireAdminId();
    await assertRateLimit("admin:verify", adminId, { limit: 3, windowMs: 10 * 60_000 });
    const provider = getJobSourceProviders().find((p) => p.key === sourceKey);
    if (!provider) return fail("Source inconnue.");
    const { verifySourceJobs } = await import("@/services/ingestion");
    const report = await verifySourceJobs({ provider, olderThanHours: 12, limit: 150, trigger: "admin" });
    if (report.skipped) return fail(report.reason ?? "Vérification impossible.");
    revalidatePath("/admin/data");
    revalidatePath("/jobs");
    return ok({ checked: report.checked, active: report.active, removed: report.removed, unknown: report.unknown });
  });
}

export async function expireJobsAdmin(): Promise<ActionResult<{ expired: number; markedUnknown: number }>> {
  return runAction("admin.expireJobs", async () => {
    await requireAdminId();
    const { expireJobs } = await import("@/services/ingestion");
    const r = await expireJobs({ trigger: "admin" });
    revalidatePath("/admin/data");
    revalidatePath("/jobs");
    return ok({ expired: r.expiredBySource + r.expiredUnverified + r.expiredTooOld, markedUnknown: r.markedUnknown });
  });
}

export async function importCompaniesAdmin(department: string): Promise<ActionResult<{ fetched: number; created: number; updated: number }>> {
  return runAction("admin.importCompanies", async () => {
    const adminId = await requireAdminId();
    await assertRateLimit("admin:companies", adminId, { limit: 3, windowMs: 10 * 60_000 });
    if (!/^(\d{2,3}|2[AB])$/.test(department)) return fail("Département invalide.");
    const { importCompanies } = await import("@/services/company-data/import");
    const { getCompanyDataProvider, JOB_FAMILY_NAF_HINTS } = await import("@/services/company-data");
    const provider = getCompanyDataProvider();
    if (!provider) return fail("Aucun fournisseur d'entreprises.");
    const r = await importCompanies({ provider, params: { nafCodes: [...new Set([...(JOB_FAMILY_NAF_HINTS["dev"] ?? []), ...(JOB_FAMILY_NAF_HINTS["marketing"] ?? [])])], departmentCodes: [department] }, maxRecords: 100, trigger: "admin" });
    if (r.errors.length && r.fetched === 0) return fail(r.errors[0] ?? "Import échoué.");
    revalidatePath("/admin/data");
    revalidatePath("/companies");
    return ok({ fetched: r.fetched, created: r.created, updated: r.updated });
  });
}

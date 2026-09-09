"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Plan, ReportStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { fail, ok, runAction, type ActionResult } from "@/lib/action";
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

/** Lance une synchronisation manuelle d'une source (si configurée). */
export async function syncSource(sourceKey: string): Promise<ActionResult<IngestReport>> {
  return runAction("admin.syncSource", async () => {
    await requireAdminId();
    const provider = getJobSourceProviders().find((p) => p.key === sourceKey);
    if (!provider) return fail("Source inconnue.");
    const { ingestFromProvider } = await import("@/services/job-sources/ingest");
    const report = await ingestFromProvider(provider, { limit: 150 });
    revalidatePath("/admin/sources");
    revalidatePath("/jobs");
    return ok(report);
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApplicationStatus, OutreachChannel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";
import { canTransition, getTransitionEffects } from "@/features/applications/lib/status-machine";
import { FOLLOW_UP_AFTER_DAYS } from "@/features/applications/lib/follow-ups";
import { APPLICATION_STATUSES } from "@/config/taxonomy";

const createSchema = z
  .object({
    jobId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
    status: z.enum(ApplicationStatus).optional(),
    notes: z.string().max(2000).optional(),
    matchScore: z.number().int().min(0).max(100).optional(),
  })
  .refine((v) => v.jobId || v.companyId, "Précise une offre ou une entreprise");

export type CreateApplicationInput = z.input<typeof createSchema>;

function revalidateAll() {
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
}

/** Crée une candidature (depuis une offre ou en spontané depuis une entreprise). Idempotent par offre. */
export async function createApplication(input: CreateApplicationInput): Promise<ActionResult<{ id: string; status: ApplicationStatus; created: boolean }>> {
  return runAction("createApplication", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(createSchema, input);
    if (!parsed.ok) return parsed.result;
    const { jobId, notes, matchScore } = parsed.data;
    const status = parsed.data.status ?? "TO_APPLY";

    let companyId = parsed.data.companyId;
    let title = "Candidature spontanée";
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, companyId: true, company: { select: { name: true } } } });
      if (!job) return fail("Offre introuvable.");
      companyId = job.companyId;
      title = job.title;
      const existing = await prisma.application.findUnique({ where: { userId_jobId: { userId, jobId } } });
      if (existing) {
        if (existing.archivedAt) {
          await prisma.application.update({ where: { id: existing.id }, data: { archivedAt: null } });
        }
        return ok({ id: existing.id, status: existing.status, created: false });
      }
    }
    if (!companyId) return fail("Entreprise introuvable.");
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    if (!company) return fail("Entreprise introuvable.");

    const effects = getTransitionEffects("TO_REVIEW", status, company.name);
    const position = await prisma.application.count({ where: { userId, status } });
    const now = new Date();
    const app = await prisma.application.create({
      data: {
        userId,
        jobId: jobId ?? null,
        companyId,
        status,
        isSpontaneous: !jobId,
        notes: notes ?? null,
        matchScore: matchScore ?? null,
        appliedAt: effects.setAppliedAt ? now : null,
        nextAction: effects.nextAction,
        nextActionAt: effects.nextActionInDays !== null ? new Date(now.getTime() + effects.nextActionInDays * 86_400_000) : null,
        position,
        events: {
          create: [
            { type: "CREATED", toStatus: status },
            ...(status !== "TO_REVIEW" ? [{ type: "STATUS_CHANGED" as const, fromStatus: "TO_REVIEW" as const, toStatus: status }] : []),
          ],
        },
      },
    });
    await trackActivity({ userId, type: "APPLICATION_CREATED", title: `${title} — ${company.name} ajouté au suivi`, jobId, companyId, applicationId: app.id });
    revalidateAll();
    return ok({ id: app.id, status, created: true });
  });
}

const moveSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(ApplicationStatus),
  position: z.number().int().min(0).optional(),
});

/** Change le statut (drag & drop Kanban ou menu) en appliquant la machine à états. */
export async function updateApplicationStatus(input: z.input<typeof moveSchema>): Promise<ActionResult<{ status: ApplicationStatus }>> {
  return runAction("updateApplicationStatus", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(moveSchema, input);
    if (!parsed.ok) return parsed.result;
    const { applicationId, status, position } = parsed.data;
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, include: { company: { select: { name: true } } } });
    if (!app) return fail("Candidature introuvable.");
    if (app.status === status) {
      if (position !== undefined) await prisma.application.update({ where: { id: app.id }, data: { position } });
      return ok({ status });
    }
    if (!canTransition(app.status, status)) {
      return fail(`Impossible de passer de « ${APPLICATION_STATUSES[app.status].label} » à « ${APPLICATION_STATUSES[status].label} ».`);
    }
    const effects = getTransitionEffects(app.status, status, app.company.name);
    const now = new Date();
    await prisma.$transaction([
      prisma.application.update({
        where: { id: app.id },
        data: {
          status,
          position: position ?? 0,
          appliedAt: effects.setAppliedAt && !app.appliedAt ? now : app.appliedAt,
          lastFollowUpAt: effects.markFollowedUp ? now : app.lastFollowUpAt,
          followUpCount: effects.markFollowedUp ? { increment: 1 } : undefined,
          followUpSnoozedUntil: effects.clearFollowUp || effects.markFollowedUp ? null : app.followUpSnoozedUntil,
          nextAction: effects.nextAction,
          nextActionAt: effects.nextActionInDays !== null ? new Date(now.getTime() + effects.nextActionInDays * 86_400_000) : null,
        },
      }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: effects.markFollowedUp ? "FOLLOW_UP_SENT" : "STATUS_CHANGED", fromStatus: app.status, toStatus: status } }),
    ]);
    await trackActivity({ userId, type: effects.markFollowedUp ? "FOLLOW_UP_SENT" : "APPLICATION_STATUS_CHANGED", title: effects.activityTitle, applicationId: app.id, companyId: app.companyId, jobId: app.jobId });
    revalidateAll();
    return ok({ status });
  });
}

const detailsSchema = z.object({
  applicationId: z.string().min(1),
  notes: z.string().max(5000).optional(),
  nextAction: z.string().max(200).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  contactId: z.string().nullable().optional(),
  resumeId: z.string().nullable().optional(),
  channel: z.enum(OutreachChannel).nullable().optional(),
});

export async function updateApplicationDetails(input: z.input<typeof detailsSchema>): Promise<ActionResult> {
  return runAction("updateApplicationDetails", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(detailsSchema, input);
    if (!parsed.ok) return parsed.result;
    const { applicationId, ...rest } = parsed.data;
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true, notes: true } });
    if (!app) return fail("Candidature introuvable.");
    await prisma.application.update({
      where: { id: app.id },
      data: {
        notes: rest.notes !== undefined ? rest.notes || null : undefined,
        nextAction: rest.nextAction !== undefined ? rest.nextAction || null : undefined,
        nextActionAt: rest.nextActionAt !== undefined ? (rest.nextActionAt ? new Date(rest.nextActionAt) : null) : undefined,
        contactId: rest.contactId !== undefined ? rest.contactId : undefined,
        resumeId: rest.resumeId !== undefined ? rest.resumeId : undefined,
        channel: rest.channel !== undefined ? rest.channel : undefined,
      },
    });
    if (rest.notes !== undefined && rest.notes !== app.notes) {
      await prisma.applicationEvent.create({ data: { applicationId: app.id, type: "NOTE_ADDED" } });
    }
    revalidateAll();
    return ok(undefined);
  });
}

/** Marque une relance comme effectuée (jamais envoyée automatiquement). */
export async function markFollowedUp(applicationId: string): Promise<ActionResult> {
  return runAction("markFollowedUp", async () => {
    const userId = await requireUserId();
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId }, include: { company: { select: { name: true } } } });
    if (!app) return fail("Candidature introuvable.");
    const now = new Date();
    await prisma.$transaction([
      prisma.application.update({
        where: { id: app.id },
        data: {
          status: app.status === "TO_FOLLOW_UP" ? "SENT" : app.status,
          lastFollowUpAt: now,
          followUpCount: { increment: 1 },
          followUpSnoozedUntil: null,
          nextAction: "Relancer à nouveau si toujours sans réponse",
          nextActionAt: new Date(now.getTime() + FOLLOW_UP_AFTER_DAYS * 86_400_000),
        },
      }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "FOLLOW_UP_SENT", fromStatus: app.status, toStatus: app.status === "TO_FOLLOW_UP" ? "SENT" : app.status } }),
    ]);
    await trackActivity({ userId, type: "FOLLOW_UP_SENT", title: `Relance envoyée à ${app.company.name}`, applicationId: app.id, companyId: app.companyId, jobId: app.jobId });
    revalidateAll();
    return ok(undefined);
  });
}

/** Reporte la relance de N jours (ignorer temporairement). */
export async function snoozeFollowUp(applicationId: string, days = 7): Promise<ActionResult> {
  return runAction("snoozeFollowUp", async () => {
    const userId = await requireUserId();
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId } });
    if (!app) return fail("Candidature introuvable.");
    const until = new Date(Date.now() + Math.min(Math.max(days, 1), 30) * 86_400_000);
    await prisma.$transaction([
      prisma.application.update({ where: { id: app.id }, data: { followUpSnoozedUntil: until, nextActionAt: until } }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "FOLLOW_UP_SNOOZED", payload: { until: until.toISOString() } } }),
    ]);
    revalidateAll();
    return ok(undefined);
  });
}

export async function archiveApplication(applicationId: string): Promise<ActionResult> {
  return runAction("archiveApplication", async () => {
    const userId = await requireUserId();
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId } });
    if (!app) return fail("Candidature introuvable.");
    await prisma.$transaction([
      prisma.application.update({ where: { id: app.id }, data: { archivedAt: new Date() } }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "ARCHIVED" } }),
    ]);
    revalidateAll();
    return ok(undefined);
  });
}

export async function deleteApplication(applicationId: string): Promise<ActionResult> {
  return runAction("deleteApplication", async () => {
    const userId = await requireUserId();
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId } });
    if (!app) return fail("Candidature introuvable.");
    await prisma.application.delete({ where: { id: app.id } });
    revalidateAll();
    return ok(undefined);
  });
}

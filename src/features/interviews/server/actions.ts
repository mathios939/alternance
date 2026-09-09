"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InterviewStatus, InterviewType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";
import { canTransition } from "@/features/applications/lib/status-machine";

const schema = z.object({
  applicationId: z.string().min(1),
  scheduledAt: z.string().min(1),
  durationMin: z.number().int().min(10).max(480).optional(),
  type: z.enum(InterviewType),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  contactId: z.string().nullable().optional(),
  notes: z.string().trim().max(3000).optional().or(z.literal("")),
});

export type InterviewInput = z.input<typeof schema>;

function revalidate() {
  revalidatePath("/interviews");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
}

export async function createInterview(input: InterviewInput): Promise<ActionResult<{ id: string }>> {
  return runAction("createInterview", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(schema, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const app = await prisma.application.findFirst({ where: { id: v.applicationId, userId }, include: { company: { select: { name: true } } } });
    if (!app) return fail("Candidature introuvable.");
    const scheduledAt = new Date(v.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return fail("Date invalide.");
    const interview = await prisma.interview.create({
      data: { userId, applicationId: app.id, companyId: app.companyId, jobId: app.jobId, contactId: v.contactId ?? null, scheduledAt, durationMin: v.durationMin ?? 45, type: v.type, location: v.location || null, notes: v.notes || null },
    });
    if (app.status !== "INTERVIEW" && canTransition(app.status, "INTERVIEW")) {
      await prisma.$transaction([
        prisma.application.update({ where: { id: app.id }, data: { status: "INTERVIEW", nextAction: "Préparer l'entretien", nextActionAt: scheduledAt, followUpSnoozedUntil: null } }),
        prisma.applicationEvent.create({ data: { applicationId: app.id, type: "STATUS_CHANGED", fromStatus: app.status, toStatus: "INTERVIEW" } }),
      ]);
    }
    await prisma.applicationEvent.create({ data: { applicationId: app.id, type: "INTERVIEW_SCHEDULED", payload: { interviewId: interview.id, scheduledAt: scheduledAt.toISOString() } } });
    await prisma.notification.create({ data: { userId, type: "INTERVIEW_REMINDER", title: `Entretien planifié chez ${app.company.name}`, body: scheduledAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }), href: `/interviews/${interview.id}` } });
    await trackActivity({ userId, type: "INTERVIEW_SCHEDULED", title: `Entretien planifié chez ${app.company.name}`, applicationId: app.id, companyId: app.companyId, jobId: app.jobId });
    revalidate();
    return ok({ id: interview.id });
  });
}

const updateSchema = schema.partial().extend({ status: z.enum(InterviewStatus).optional(), preparationNotes: z.string().max(5000).optional() });

export async function updateInterview(id: string, input: z.input<typeof updateSchema>): Promise<ActionResult> {
  return runAction("updateInterview", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(updateSchema, input);
    if (!parsed.ok) return parsed.result;
    const existing = await prisma.interview.findFirst({ where: { id, userId } });
    if (!existing) return fail("Entretien introuvable.");
    const v = parsed.data;
    await prisma.interview.update({
      where: { id },
      data: {
        scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : undefined,
        durationMin: v.durationMin,
        type: v.type,
        status: v.status,
        location: v.location !== undefined ? v.location || null : undefined,
        contactId: v.contactId !== undefined ? v.contactId : undefined,
        notes: v.notes !== undefined ? v.notes || null : undefined,
      },
    });
    revalidate();
    return ok(undefined);
  });
}

export async function deleteInterview(id: string): Promise<ActionResult> {
  return runAction("deleteInterview", async () => {
    const userId = await requireUserId();
    const existing = await prisma.interview.findFirst({ where: { id, userId } });
    if (!existing) return fail("Entretien introuvable.");
    await prisma.interview.delete({ where: { id } });
    revalidate();
    return ok(undefined);
  });
}

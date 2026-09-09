"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OutreachChannel, OutreachStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";

const baseSchema = z.object({
  companyId: z.string().min(1),
  contactId: z.string().nullable().optional(),
  channel: z.enum(OutreachChannel),
  status: z.enum(OutreachStatus),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  lastContactAt: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type OutreachInput = z.input<typeof baseSchema>;

export async function createOutreach(input: OutreachInput): Promise<ActionResult<{ id: string }>> {
  return runAction("createOutreach", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(baseSchema, input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const company = await prisma.company.findUnique({ where: { id: v.companyId }, select: { id: true, name: true } });
    if (!company) return fail("Entreprise introuvable.");
    if (v.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: v.contactId, companyId: v.companyId } });
      if (!contact) return fail("Contact introuvable pour cette entreprise.");
    }
    const row = await prisma.outreach.create({
      data: {
        userId,
        companyId: v.companyId,
        contactId: v.contactId ?? null,
        channel: v.channel,
        status: v.status,
        subject: v.subject || null,
        lastContactAt: v.lastContactAt ? new Date(v.lastContactAt) : v.status === "SENT" ? new Date() : null,
        nextFollowUpAt: v.nextFollowUpAt ? new Date(v.nextFollowUpAt) : null,
        notes: v.notes || null,
      },
    });
    if (v.status === "SENT") await trackActivity({ userId, type: "COMPANY_CONTACTED", title: `${company.name} contacté`, companyId: company.id });
    revalidatePath("/outreach");
    return ok({ id: row.id });
  });
}

export async function updateOutreach(id: string, input: Partial<OutreachInput>): Promise<ActionResult> {
  return runAction("updateOutreach", async () => {
    const userId = await requireUserId();
    const existing = await prisma.outreach.findFirst({ where: { id, userId }, include: { company: { select: { name: true } } } });
    if (!existing) return fail("Entrée introuvable.");
    const parsed = parseInput(baseSchema.partial(), input);
    if (!parsed.ok) return parsed.result;
    const v = parsed.data;
    const becameSent = v.status === "SENT" && existing.status !== "SENT";
    await prisma.outreach.update({
      where: { id },
      data: {
        contactId: v.contactId !== undefined ? v.contactId : undefined,
        channel: v.channel,
        status: v.status,
        subject: v.subject !== undefined ? v.subject || null : undefined,
        lastContactAt: v.lastContactAt !== undefined ? (v.lastContactAt ? new Date(v.lastContactAt) : null) : becameSent ? new Date() : undefined,
        nextFollowUpAt: v.nextFollowUpAt !== undefined ? (v.nextFollowUpAt ? new Date(v.nextFollowUpAt) : null) : undefined,
        notes: v.notes !== undefined ? v.notes || null : undefined,
      },
    });
    if (becameSent) await trackActivity({ userId, type: "COMPANY_CONTACTED", title: `${existing.company.name} contacté`, companyId: existing.companyId });
    revalidatePath("/outreach");
    return ok(undefined);
  });
}

export async function deleteOutreach(id: string): Promise<ActionResult> {
  return runAction("deleteOutreach", async () => {
    const userId = await requireUserId();
    const existing = await prisma.outreach.findFirst({ where: { id, userId } });
    if (!existing) return fail("Entrée introuvable.");
    await prisma.outreach.delete({ where: { id } });
    revalidatePath("/outreach");
    return ok(undefined);
  });
}

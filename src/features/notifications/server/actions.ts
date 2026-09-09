"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DigestFrequency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { ok, parseInput, runAction, type ActionResult } from "@/lib/action";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  return runAction("markNotificationRead", async () => {
    const userId = await requireUserId();
    await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/notifications");
    return ok(undefined);
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return runAction("markAllNotificationsRead", async () => {
    const userId = await requireUserId();
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/notifications");
    revalidatePath("/dashboard");
    return ok(undefined);
  });
}

const prefSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  newJobs: z.boolean(),
  highMatchJobs: z.boolean(),
  followUps: z.boolean(),
  newCompanies: z.boolean(),
  interviewReminders: z.boolean(),
  digestFrequency: z.enum(DigestFrequency),
  minMatchScore: z.number().int().min(0).max(100),
});

export type AlertPreferenceInput = z.input<typeof prefSchema>;

export async function updateAlertPreference(input: AlertPreferenceInput): Promise<ActionResult> {
  return runAction("updateAlertPreference", async () => {
    const userId = await requireUserId();
    const parsed = parseInput(prefSchema, input);
    if (!parsed.ok) return parsed.result;
    await prisma.alertPreference.upsert({ where: { userId }, update: parsed.data, create: { userId, ...parsed.data } });
    revalidatePath("/notifications");
    revalidatePath("/settings/alerts");
    return ok(undefined);
  });
}

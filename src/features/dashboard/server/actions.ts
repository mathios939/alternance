"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { fail, ok, runAction, type ActionResult } from "@/lib/action";
import { trackActivity } from "@/features/activity/server/track";

export async function completeDailyAction(id: string, done = true): Promise<ActionResult> {
  return runAction("completeDailyAction", async () => {
    const userId = await requireUserId();
    const action = await prisma.dailyAction.findFirst({ where: { id, userId } });
    if (!action) return fail("Action introuvable.");
    await prisma.dailyAction.update({ where: { id }, data: { completedAt: done ? new Date() : null, skippedAt: null } });
    if (done) await trackActivity({ userId, type: "DAILY_ACTION_COMPLETED", title: action.title, jobId: action.jobId, companyId: action.companyId, applicationId: action.applicationId });
    revalidatePath("/dashboard");
    return ok(undefined);
  });
}

export async function skipDailyAction(id: string): Promise<ActionResult> {
  return runAction("skipDailyAction", async () => {
    const userId = await requireUserId();
    const action = await prisma.dailyAction.findFirst({ where: { id, userId } });
    if (!action) return fail("Action introuvable.");
    await prisma.dailyAction.update({ where: { id }, data: { skippedAt: new Date() } });
    revalidatePath("/dashboard");
    return ok(undefined);
  });
}

/** Régénère la mission du jour (supprime les actions non complétées du jour). */
export async function regenerateDailyMission(): Promise<ActionResult> {
  return runAction("regenerateDailyMission", async () => {
    const userId = await requireUserId();
    const today = new Date(new Date().toISOString().slice(0, 10));
    await prisma.dailyAction.deleteMany({ where: { userId, date: today, completedAt: null } });
    revalidatePath("/dashboard");
    return ok(undefined);
  });
}

import "server-only";
import { prisma } from "@/lib/db";
import type { ActivityType } from "@/generated/prisma/enums";
import { createLogger } from "@/lib/logger";

const log = createLogger("activity");

/** Journalise une activité utilisateur (alimente la timeline, le streak et les statistiques). */
export async function trackActivity(input: { userId: string; type: ActivityType; title: string; jobId?: string | null; companyId?: string | null; applicationId?: string | null; metadata?: Record<string, unknown> }): Promise<void> {
  try {
    const today = new Date();
    await prisma.$transaction([
      prisma.activity.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          jobId: input.jobId ?? null,
          companyId: input.companyId ?? null,
          applicationId: input.applicationId ?? null,
          metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        },
      }),
      prisma.user.update({ where: { id: input.userId }, data: { lastActiveAt: today } }),
    ]);
    await updateStreak(input.userId, today);
  } catch (error) {
    log.warn("Activité non journalisée", { error: String(error), type: input.type });
  }
}

async function updateStreak(userId: string, now: Date): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true, currentStreak: true, longestStreak: true, lastActiveDate: true } });
  if (!profile) return;
  const todayKey = now.toISOString().slice(0, 10);
  const lastKey = profile.lastActiveDate?.toISOString().slice(0, 10);
  if (lastKey === todayKey) return;
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const current = lastKey === yesterday ? profile.currentStreak + 1 : 1;
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { currentStreak: current, longestStreak: Math.max(current, profile.longestStreak), lastActiveDate: now },
  });
}

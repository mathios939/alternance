import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

export const getUnreadCounts = cache(async (userId: string) => {
  const [notifications, followUps, interviews] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.application.count({ where: { userId, archivedAt: null, OR: [{ status: "TO_FOLLOW_UP" }, { status: "SENT", appliedAt: { lte: new Date(Date.now() - 7 * 86_400_000) }, lastFollowUpAt: null, followUpSnoozedUntil: null }] } }),
    prisma.interview.count({ where: { userId, status: "SCHEDULED", scheduledAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } } }),
  ]);
  return { notifications, followUps, interviews };
});

export type UnreadCounts = Awaited<ReturnType<typeof getUnreadCounts>>;

export const getRecentNotifications = cache(async (userId: string, limit = 8) => {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
});

export async function listNotifications(userId: string, options?: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 30;
  const where = { userId, ...(options?.unreadOnly ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export const getAlertPreference = cache(async (userId: string) => {
  return prisma.alertPreference.upsert({ where: { userId }, update: {}, create: { userId } });
});

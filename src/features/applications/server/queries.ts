import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { getFollowUpRecommendations } from "@/features/applications/lib/follow-ups";
import type { ApplicationCardData, ApplicationDetailData, BoardData } from "@/features/applications/types";

export const applicationInclude = {
  job: { select: { id: true, slug: true, title: true, city: true, isDemo: true } },
  company: { select: { id: true, slug: true, name: true, logoUrl: true, city: true } },
  contact: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  resume: { select: { id: true, title: true } },
  coverLetter: { select: { id: true, title: true } },
  interviews: { where: { status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, take: 1, select: { scheduledAt: true } },
} satisfies Prisma.ApplicationInclude;

type AppRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

function days(from: Date | null, now: Date): number | null {
  return from ? Math.floor((now.getTime() - from.getTime()) / 86_400_000) : null;
}

export function toApplicationCard(a: AppRow, now = new Date(), needsFollowUp = false): ApplicationCardData {
  return {
    id: a.id,
    status: a.status,
    position: a.position,
    appliedAt: a.appliedAt?.toISOString() ?? null,
    nextAction: a.nextAction,
    nextActionAt: a.nextActionAt?.toISOString() ?? null,
    notes: a.notes,
    matchScore: a.matchScore,
    isSpontaneous: a.isSpontaneous,
    followUpCount: a.followUpCount,
    lastFollowUpAt: a.lastFollowUpAt?.toISOString() ?? null,
    followUpSnoozedUntil: a.followUpSnoozedUntil?.toISOString() ?? null,
    channel: a.channel,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    job: a.job,
    company: a.company,
    contact: a.contact ? { id: a.contact.id, name: `${a.contact.firstName} ${a.contact.lastName}`, jobTitle: a.contact.jobTitle } : null,
    resume: a.resume,
    coverLetter: a.coverLetter,
    nextInterviewAt: a.interviews[0]?.scheduledAt.toISOString() ?? null,
    needsFollowUp,
    daysSinceApplied: days(a.appliedAt, now),
  };
}

export async function getApplicationsBoard(userId: string): Promise<BoardData> {
  const now = new Date();
  const rows = await prisma.application.findMany({ where: { userId, archivedAt: null }, include: applicationInclude, orderBy: [{ position: "asc" }, { updatedAt: "desc" }] });
  const followUps = getFollowUpRecommendations(
    rows.map((a) => ({ id: a.id, status: a.status, appliedAt: a.appliedAt, lastFollowUpAt: a.lastFollowUpAt, followUpCount: a.followUpCount, followUpSnoozedUntil: a.followUpSnoozedUntil, companyName: a.company.name, jobTitle: a.job?.title ?? null })),
    now,
  );
  const needs = new Set(followUps.map((f) => f.applicationId));
  const columns = Object.fromEntries(Object.values(ApplicationStatus).map((s) => [s, [] as ApplicationCardData[]])) as Record<ApplicationStatus, ApplicationCardData[]>;
  for (const row of rows) columns[row.status].push(toApplicationCard(row, now, needs.has(row.id)));
  return { columns, followUps, total: rows.length };
}

export async function getApplicationDetail(userId: string, id: string): Promise<ApplicationDetailData | null> {
  const a = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      ...applicationInclude,
      events: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, title: true, createdAt: true, provider: true } },
    },
  });
  if (!a) return null;
  const [contacts, resumes, interviews] = await Promise.all([
    prisma.contact.findMany({ where: { companyId: a.companyId, optOutAt: null }, select: { id: true, firstName: true, lastName: true, jobTitle: true } }),
    prisma.resume.findMany({ where: { userId }, select: { id: true, title: true }, orderBy: { isDefault: "desc" } }),
    prisma.interview.findMany({ where: { applicationId: a.id }, orderBy: { scheduledAt: "desc" }, select: { id: true, scheduledAt: true, type: true, status: true } }),
  ]);
  const now = new Date();
  const needs = getFollowUpRecommendations([{ id: a.id, status: a.status, appliedAt: a.appliedAt, lastFollowUpAt: a.lastFollowUpAt, followUpCount: a.followUpCount, followUpSnoozedUntil: a.followUpSnoozedUntil, companyName: a.company.name, jobTitle: a.job?.title ?? null }], now).length > 0;
  return {
    ...toApplicationCard(a, now, needs),
    events: a.events.map((e) => ({ id: e.id, type: e.type, fromStatus: e.fromStatus, toStatus: e.toStatus, createdAt: e.createdAt.toISOString(), payload: e.payload })),
    documents: a.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    interviews: interviews.map((i) => ({ id: i.id, scheduledAt: i.scheduledAt.toISOString(), type: i.type, status: i.status })),
    availableContacts: contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, jobTitle: c.jobTitle })),
    availableResumes: resumes,
  };
}

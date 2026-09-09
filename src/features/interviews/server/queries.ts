import "server-only";
import { prisma } from "@/lib/db";

export const interviewInclude = {
  company: { select: { id: true, slug: true, name: true, logoUrl: true, city: true } },
  job: { select: { id: true, slug: true, title: true } },
  contact: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  application: { select: { id: true, status: true } },
} as const;

export async function getInterviews(userId: string) {
  const rows = await prisma.interview.findMany({ where: { userId }, include: interviewInclude, orderBy: { scheduledAt: "asc" } });
  const now = Date.now();
  return {
    upcoming: rows.filter((i) => i.scheduledAt.getTime() >= now && i.status === "SCHEDULED"),
    past: rows.filter((i) => i.scheduledAt.getTime() < now || i.status !== "SCHEDULED").reverse(),
  };
}

export async function getInterview(userId: string, id: string) {
  return prisma.interview.findFirst({ where: { id, userId }, include: interviewInclude });
}

export type InterviewRow = Awaited<ReturnType<typeof getInterviews>>["upcoming"][number];

/** Candidatures pouvant recevoir un entretien (sélecteur de création). */
export async function getApplicationsForInterview(userId: string) {
  const apps = await prisma.application.findMany({ where: { userId, archivedAt: null, status: { in: ["SENT", "TO_FOLLOW_UP", "INTERVIEW", "OFFER"] } }, include: { company: { select: { id: true, name: true } }, job: { select: { title: true } } }, orderBy: { updatedAt: "desc" } });
  return apps.map((a) => ({ id: a.id, companyId: a.company.id, label: `${a.company.name}${a.job ? ` — ${a.job.title}` : " — spontanée"}` }));
}

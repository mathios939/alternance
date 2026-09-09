import "server-only";
import { prisma } from "@/lib/db";
import { buildDailyMission, getNextBestAction, type NextBestAction, type UserStateForActions } from "@/lib/matching";
import { getCandidateContext } from "@/features/profile/server/queries";
import { countNewJobs, getTopMatches } from "@/features/jobs/server/queries";
import { getRadar } from "@/features/companies/server/queries";
import { getFollowUpRecommendations } from "@/features/applications/lib/follow-ups";
import { computeStreak, startOfWeek, weeklyProgress } from "@/features/dashboard/lib/streak";
import { SENT_STATUSES } from "@/features/applications/lib/status-machine";
import type { DailyActionType } from "@/generated/prisma/enums";

export type DailyActionView = {
  id: string;
  type: DailyActionType;
  title: string;
  description: string | null;
  href: string | null;
  completedAt: Date | null;
  skippedAt: Date | null;
};

/** Construit l'état utilisateur nécessaire à la prochaine meilleure action et à la mission du jour. */
export async function buildUserState(userId: string): Promise<{ state: UserStateForActions; ctx: NonNullable<Awaited<ReturnType<typeof getCandidateContext>>> } | null> {
  const ctx = await getCandidateContext(userId);
  if (!ctx) return null;
  const now = new Date();
  const [interviews, applications, savedJobs, topMatches, radar, appsThisWeek, resumeVersion] = await Promise.all([
    prisma.interview.findMany({ where: { userId, status: "SCHEDULED", scheduledAt: { gte: now } }, include: { company: { select: { name: true } } }, orderBy: { scheduledAt: "asc" }, take: 5 }),
    prisma.application.findMany({ where: { userId, archivedAt: null, status: { in: ["SENT", "TO_FOLLOW_UP"] } }, include: { company: { select: { name: true } }, job: { select: { title: true } } } }),
    prisma.favorite.findMany({ where: { userId, jobId: { not: null }, job: { applications: { none: { userId, archivedAt: null } } } }, include: { job: { select: { id: true, title: true, slug: true, company: { select: { name: true } } } } }, take: 5 }),
    getTopMatches({ userId, candidate: ctx.candidate }, { limit: 6, minScore: 60 }),
    getRadar({ userId, candidate: ctx.candidate }, { limit: 6 }),
    prisma.application.count({ where: { userId, appliedAt: { gte: startOfWeek(now) } } }),
    prisma.resumeVersion.findFirst({ where: { resume: { userId } }, orderBy: { createdAt: "desc" }, select: { analysis: true } }),
  ]);
  const followUps = getFollowUpRecommendations(
    applications.map((a) => ({ id: a.id, status: a.status, appliedAt: a.appliedAt, lastFollowUpAt: a.lastFollowUpAt, followUpCount: a.followUpCount, followUpSnoozedUntil: a.followUpSnoozedUntil, companyName: a.company.name, jobTitle: a.job?.title ?? null })),
    now,
  );
  const analysis = resumeVersion?.analysis as { score?: number } | null;
  const state: UserStateForActions = {
    profileCompletion: ctx.completion.score,
    hasResume: ctx.hasResume,
    resumeScore: typeof analysis?.score === "number" ? analysis.score : null,
    upcomingInterviews: interviews.map((i) => ({ id: i.id, companyName: i.company.name, scheduledAt: i.scheduledAt, applicationId: i.applicationId })),
    followUpsDue: followUps.map((f) => ({ applicationId: f.applicationId, companyName: f.companyName, daysSinceApplied: f.daysSinceApplied })),
    highMatchJobs: topMatches.filter((j) => (j.match?.total ?? 0) >= 75).map((j) => ({ jobId: j.id, title: j.title, companyName: j.company.name, matchScore: j.match?.total ?? 0, city: j.city, slug: j.slug })),
    radarCompanies: radar.items.filter((c) => !c.hasApplication && (c.opportunity?.score ?? 0) >= 60).map((c) => ({ companyId: c.id, name: c.name, opportunityScore: c.opportunity?.score ?? 0, slug: c.slug, city: c.city })),
    applicationsThisWeek: appsThisWeek,
    weeklyGoal: ctx.profile.weeklyGoal,
    savedJobsNotApplied: savedJobs.filter((f) => f.job).map((f) => ({ jobId: f.job!.id, title: f.job!.title, companyName: f.job!.company.name, slug: f.job!.slug })),
    urgencyMode: ctx.profile.urgencyMode,
    now,
  };
  return { state, ctx };
}

/** Mission du jour : générée une fois par jour et persistée (DailyAction), complétable. */
export async function getOrCreateDailyMission(userId: string, state: UserStateForActions): Promise<DailyActionView[]> {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const existing = await prisma.dailyAction.findMany({ where: { userId, date: today }, orderBy: { priority: "desc" } });
  if (existing.length > 0) return existing.map(toView);
  const mission = buildDailyMission(state, state.urgencyMode ? 7 : 5);
  if (mission.length === 0) return [];
  await prisma.dailyAction.createMany({
    data: mission.map((a: NextBestAction) => ({
      userId,
      date: today,
      type: a.type,
      title: a.title,
      description: a.description,
      href: a.href,
      priority: Math.round(a.priority),
      jobId: a.jobId ?? null,
      companyId: a.companyId ?? null,
      applicationId: a.applicationId ?? null,
    })),
  });
  const created = await prisma.dailyAction.findMany({ where: { userId, date: today }, orderBy: { priority: "desc" } });
  return created.map(toView);
}

function toView(a: { id: string; type: DailyActionType; title: string; description: string | null; href: string | null; completedAt: Date | null; skippedAt: Date | null }): DailyActionView {
  return { id: a.id, type: a.type, title: a.title, description: a.description, href: a.href, completedAt: a.completedAt, skippedAt: a.skippedAt };
}

export async function getDashboardData(userId: string) {
  const built = await buildUserState(userId);
  if (!built) return null;
  const { state, ctx } = built;
  const now = new Date();
  const [mission, newJobs, radar, topMatches, activities, kpis, interviews] = await Promise.all([
    getOrCreateDailyMission(userId, state),
    countNewJobs({ candidate: ctx.candidate }, 24),
    getRadar({ userId, candidate: ctx.candidate }, { limit: 4 }),
    getTopMatches({ userId, candidate: ctx.candidate }, { limit: 3 }),
    prisma.activity.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
    Promise.all([
      prisma.application.count({ where: { userId, archivedAt: null, appliedAt: { gte: startOfWeek(now) } } }),
      prisma.application.count({ where: { userId, archivedAt: null, status: { in: SENT_STATUSES } } }),
      prisma.interview.count({ where: { userId, status: "SCHEDULED", scheduledAt: { gte: now } } }),
    ]),
    prisma.interview.findMany({ where: { userId, status: "SCHEDULED", scheduledAt: { gte: now } }, include: { company: { select: { name: true, slug: true } }, job: { select: { title: true } } }, orderBy: { scheduledAt: "asc" }, take: 2 }),
  ]);
  const activityDates = await prisma.activity.findMany({ where: { userId, createdAt: { gte: new Date(now.getTime() - 60 * 86_400_000) } }, select: { createdAt: true } });
  const streak = computeStreak(activityDates.map((a) => a.createdAt), now);
  const weekly = weeklyProgress(kpis[0], ctx.profile.weeklyGoal);
  return {
    profile: ctx.profile,
    completion: ctx.completion,
    nextBestAction: getNextBestAction(state),
    mission,
    kpis: {
      newJobs,
      companiesToContact: radar.total,
      applicationsThisWeek: kpis[0],
      applicationsTotal: kpis[1],
      followUps: state.followUpsDue.length,
      interviews: kpis[2],
    },
    topMatches,
    radarCompanies: radar.items,
    activities,
    streak,
    weekly,
    interviews,
    urgencyMode: ctx.profile.urgencyMode,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

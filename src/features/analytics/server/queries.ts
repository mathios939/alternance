import "server-only";
import { prisma } from "@/lib/db";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { APPLICATION_STATUSES } from "@/config/taxonomy";
import { RESPONSE_STATUSES, SENT_STATUSES } from "@/features/applications/lib/status-machine";

export const MIN_SAMPLE = 5;

function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

export async function getAnalytics(userId: string, weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 86_400_000);
  const [applications, events, interviews, favorites, jobsViewed, docs] = await Promise.all([
    prisma.application.findMany({ where: { userId }, select: { id: true, status: true, appliedAt: true, createdAt: true, matchScore: true, channel: true, isSpontaneous: true, job: { select: { source: true, city: true } } } }),
    prisma.applicationEvent.findMany({ where: { application: { userId }, type: { in: ["STATUS_CHANGED", "FOLLOW_UP_SENT"] } }, select: { type: true, toStatus: true, createdAt: true, applicationId: true } }),
    prisma.interview.count({ where: { userId } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.activity.count({ where: { userId, type: "JOB_VIEWED" } }),
    prisma.generatedDocument.count({ where: { userId } }),
  ]);

  const sent = applications.filter((a) => (SENT_STATUSES as ApplicationStatus[]).includes(a.status));
  const responded = applications.filter((a) => (RESPONSE_STATUSES as ApplicationStatus[]).includes(a.status));
  const interviewsFromApps = applications.filter((a) => ["INTERVIEW", "OFFER", "ACCEPTED"].includes(a.status));
  const offers = applications.filter((a) => a.status === "OFFER" || a.status === "ACCEPTED");
  const followUps = events.filter((e) => e.type === "FOLLOW_UP_SENT");

  // Candidatures par semaine (envoyées) et réponses par semaine (passage à un statut de réponse)
  const weekKeys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) weekKeys.push(weekKey(new Date(Date.now() - i * 7 * 86_400_000)));
  const perWeek = weekKeys.map((key) => ({ week: key, sent: 0, responses: 0 }));
  const idx = new Map(weekKeys.map((k, i) => [k, i]));
  for (const a of sent) {
    if (!a.appliedAt || a.appliedAt < since) continue;
    const i = idx.get(weekKey(a.appliedAt));
    if (i !== undefined) perWeek[i]!.sent++;
  }
  for (const e of events) {
    if (e.type !== "STATUS_CHANGED" || !e.toStatus || !(RESPONSE_STATUSES as ApplicationStatus[]).includes(e.toStatus) || e.createdAt < since) continue;
    const i = idx.get(weekKey(e.createdAt));
    if (i !== undefined) perWeek[i]!.responses++;
  }

  const byStatus = (Object.keys(APPLICATION_STATUSES) as ApplicationStatus[]).sort((a, b) => APPLICATION_STATUSES[a].order - APPLICATION_STATUSES[b].order).map((s) => ({ status: s, label: APPLICATION_STATUSES[s].label, count: applications.filter((a) => a.status === s).length }));

  // Sources / canaux : taux de réponse par origine
  const groups = new Map<string, { sent: number; responses: number }>();
  for (const a of sent) {
    const key = a.isSpontaneous ? "Candidature spontanée" : a.job?.source === "FRANCE_TRAVAIL" ? "France Travail" : a.job?.source === "COMPANY_CAREER" ? "Site carrières" : a.job?.source === "MANUAL" ? "Base Alternance OS" : "Autre";
    const g = groups.get(key) ?? { sent: 0, responses: 0 };
    g.sent++;
    if ((RESPONSE_STATUSES as ApplicationStatus[]).includes(a.status)) g.responses++;
    groups.set(key, g);
  }
  const bySource = [...groups.entries()].map(([source, g]) => ({ source, ...g, rate: g.sent ? Math.round((g.responses / g.sent) * 100) : 0 })).sort((a, b) => b.sent - a.sent);

  const matchScores = sent.map((a) => a.matchScore).filter((n): n is number => typeof n === "number");
  const avgMatch = matchScores.length ? Math.round(matchScores.reduce((s, n) => s + n, 0) / matchScores.length) : null;
  const respondedMatch = responded.map((a) => a.matchScore).filter((n): n is number => typeof n === "number");
  const avgMatchResponded = respondedMatch.length ? Math.round(respondedMatch.reduce((s, n) => s + n, 0) / respondedMatch.length) : null;

  return {
    totals: { applications: applications.length, sent: sent.length, responses: responded.length, interviews: Math.max(interviews, interviewsFromApps.length), offers: offers.length, followUps: followUps.length, favorites, jobsViewed, docs },
    rates: { response: sent.length ? Math.round((responded.length / sent.length) * 100) : null, interview: sent.length ? Math.round((interviewsFromApps.length / sent.length) * 100) : null },
    sampleOk: sent.length >= MIN_SAMPLE,
    perWeek,
    byStatus,
    bySource,
    avgMatch,
    avgMatchResponded,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

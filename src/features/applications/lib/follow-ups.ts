import type { ApplicationStatus } from "@/generated/prisma/enums";

export const FOLLOW_UP_AFTER_DAYS = 7;
export const MAX_FOLLOW_UPS = 3;

export type ApplicationForFollowUp = {
  id: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
  lastFollowUpAt: Date | null;
  followUpCount: number;
  followUpSnoozedUntil: Date | null;
  companyName: string;
  jobTitle: string | null;
};

export type FollowUpRecommendation = {
  applicationId: string;
  companyName: string;
  jobTitle: string | null;
  daysSinceApplied: number;
  daysSinceLastFollowUp: number | null;
  followUpCount: number;
  urgency: "high" | "normal";
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Règle : une candidature envoyée depuis ≥ 7 jours sans réponse doit être relancée,
 * puis à nouveau 7 jours après chaque relance, maximum 3 relances.
 * Une relance "snoozée" n'est pas proposée avant la date choisie.
 */
export function getFollowUpRecommendations(applications: ApplicationForFollowUp[], now = new Date()): FollowUpRecommendation[] {
  const results: FollowUpRecommendation[] = [];
  for (const app of applications) {
    if (app.status !== "SENT" && app.status !== "TO_FOLLOW_UP") continue;
    if (!app.appliedAt) continue;
    if (app.followUpCount >= MAX_FOLLOW_UPS) continue;
    if (app.followUpSnoozedUntil && app.followUpSnoozedUntil > now) continue;
    const reference = app.lastFollowUpAt ?? app.appliedAt;
    const daysSinceReference = daysBetween(reference, now);
    const daysSinceApplied = daysBetween(app.appliedAt, now);
    if (daysSinceReference < FOLLOW_UP_AFTER_DAYS) continue;
    results.push({
      applicationId: app.id,
      companyName: app.companyName,
      jobTitle: app.jobTitle,
      daysSinceApplied,
      daysSinceLastFollowUp: app.lastFollowUpAt ? daysBetween(app.lastFollowUpAt, now) : null,
      followUpCount: app.followUpCount,
      urgency: daysSinceReference >= FOLLOW_UP_AFTER_DAYS * 2 ? "high" : "normal",
    });
  }
  return results.sort((a, b) => b.daysSinceApplied - a.daysSinceApplied);
}

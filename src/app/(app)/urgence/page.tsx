import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getTopMatches } from "@/features/jobs/server/queries";
import { getRadar } from "@/features/companies/server/queries";
import { getApplicationsBoard } from "@/features/applications/server/queries";
import { startOfWeek } from "@/features/dashboard/lib/streak";
import { UrgencyPlan } from "@/features/urgence/components/urgency-plan";
import { UrgencyToggle } from "@/features/settings/components/urgency-toggle";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Mode urgence" };

export default async function UrgencePage() {
  const user = await requireUser();
  const ctx = await getCandidateContext(user.id);
  if (!ctx) return null;
  const weekStart = startOfWeek();
  const [jobs, radar, board, contactsThisWeek, followUpsThisWeek] = await Promise.all([
    getTopMatches({ userId: user.id, candidate: ctx.candidate }, { limit: 6, minScore: 60 }),
    getRadar({ userId: user.id, candidate: ctx.candidate }, { limit: 8 }),
    getApplicationsBoard(user.id),
    prisma.outreach.count({ where: { userId: user.id, lastContactAt: { gte: weekStart } } }),
    prisma.applicationEvent.count({ where: { application: { userId: user.id }, type: "FOLLOW_UP_SENT", createdAt: { gte: weekStart } } }),
  ]);
  const applicationsThisWeek = await prisma.application.count({ where: { userId: user.id, appliedAt: { gte: weekStart } } });
  const enabled = ctx.profile.urgencyMode;
  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Je dois trouver une alternance rapidement" title="Mode urgence" description="Un plan intensif, jour par jour, construit à partir de tes meilleures cibles." actions={<UrgencyToggle enabled={enabled} weeklyGoal={ctx.profile.weeklyGoal} />} />
      {!enabled ? (
        <Alert variant="warning">
          <Zap />
          <AlertTitle>Le mode urgence est désactivé</AlertTitle>
          <AlertDescription>Active-le pour passer l'objectif hebdomadaire à 30 candidatures ciblées, 20 entreprises contactées et 5 relances, avec une mission du jour renforcée. Tu peux le désactiver à tout moment.</AlertDescription>
        </Alert>
      ) : null}
      <UrgencyPlan
        today={{ jobs: jobs.slice(0, 5), companies: radar.items.filter((c) => !c.hasApplication).slice(0, 8), followUps: board.followUps.slice(0, 5).map((f) => ({ applicationId: f.applicationId, companyName: f.companyName, daysSinceApplied: f.daysSinceApplied })) }}
        week={{ applications: { done: applicationsThisWeek, goal: enabled ? 30 : ctx.profile.weeklyGoal }, contacts: { done: contactsThisWeek, goal: enabled ? 20 : 10 }, followUps: { done: followUpsThisWeek, goal: 5 } }}
      />
    </PageContainer>
  );
}

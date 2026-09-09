import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, Building2, CalendarClock, KanbanSquare, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/features/dashboard/server/queries";
import { formatDateTime } from "@/lib/format";
import { PageContainer } from "@/components/layout/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";
import { DailyMission } from "@/features/dashboard/components/daily-mission";
import { ActivityTimeline } from "@/features/dashboard/components/activity-timeline";
import { WeeklyGoal } from "@/features/dashboard/components/weekly-goal";

export const metadata: Metadata = { title: "Tableau de bord" };

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  if (!data) redirect("/onboarding");
  const { profile, completion, nextBestAction, mission, kpis, topMatches, radarCompanies, activities, streak, weekly, interviews, urgencyMode } = data;

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting()} {profile.firstName} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Voici les meilleures opportunités pour toi aujourd'hui.</p>
        </div>
        {nextBestAction ? (
          <Button asChild size="lg" variant="gradient">
            <Link href={nextBestAction.href}>
              <Sparkles aria-hidden /> {nextBestAction.title} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>

      {completion.score < 70 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Profil complété à {completion.score} %</p>
            <p className="text-sm text-muted-foreground">
              Il manque : {completion.missing.slice(0, 3).map((m) => m.label.toLowerCase()).join(", ")}. Un profil complet donne des scores plus fiables.
            </p>
            <Progress value={completion.score} className="mt-2 h-1.5 max-w-xs" />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/profile">Compléter</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DailyMission actions={mission} urgencyMode={urgencyMode} />
        <WeeklyGoal weekly={weekly} streak={streak} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nouvelles offres" value={kpis.newJobs} hint="dans ta zone, ces 24 h" icon={Briefcase} href="/jobs?published=24h&sort=match" tone="primary" />
        <StatCard label="Entreprises à contacter" value={kpis.companiesToContact} hint="repérées par le Radar" icon={Building2} href="/radar" tone="info" />
        <StatCard label="Candidatures" value={kpis.applicationsThisWeek} hint={`cette semaine · ${kpis.applicationsTotal} au total`} icon={KanbanSquare} href="/applications" tone="success" />
        <StatCard label="Relances" value={kpis.followUps} hint={kpis.followUps > 0 ? "candidatures à relancer" : "rien à relancer"} icon={RefreshCw} href="/applications?filter=followups" tone="warning" />
      </div>

      {interviews.length > 0 ? (
        <section className="surface p-5">
          <SectionHeading title="Prochains entretiens" href="/interviews" hrefLabel="Tous les entretiens" as="h2" />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {interviews.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-info-soft text-info">
                  <CalendarClock className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.company.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(i.scheduledAt)}
                    {i.job ? ` · ${i.job.title}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="soft">
                  <Link href={`/interviews/${i.id}`}>Préparer</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionHeading title="Meilleurs matchs" description="Les offres que tu devrais traiter en premier." href="/jobs?sort=match" hrefLabel="Toutes mes offres" />
        {topMatches.length === 0 ? (
          <EmptyState className="mt-4" title="Aucune offre compatible pour le moment" description="Élargis ton rayon ou tes secteurs dans ton profil, ou consulte le Radar." action={<Button asChild><Link href="/jobs">Explorer les offres</Link></Button>} />
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {topMatches.map((job) => (
              <JobCard key={job.id} job={job} variant="large" />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Entreprises à contacter" description="Potentiel estimé par le Radar, avec ou sans offre publiée." href="/radar" hrefLabel="Ouvrir le Radar" />
        {radarCompanies.length === 0 ? (
          <EmptyState className="mt-4" compact title="Le Radar n'a rien trouvé dans ton rayon" description="Augmente ton rayon de recherche dans ton profil." />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {radarCompanies.map((c) => (
              <CompanyCard key={c.id} company={c} variant="compact" />
            ))}
          </div>
        )}
      </section>

      <section className="surface p-5">
        <SectionHeading title="Activité récente" href="/analytics" hrefLabel="Statistiques" as="h2" />
        <div className="mt-4">
          <ActivityTimeline items={activities} />
        </div>
      </section>
    </PageContainer>
  );
}

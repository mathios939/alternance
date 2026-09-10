import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, RefreshCw, Send, Target, Zap } from "lucide-react";
import type { JobCardData } from "@/features/jobs/types";
import type { CompanyCardData } from "@/features/companies/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";

type Props = {
  today: { jobs: JobCardData[]; companies: CompanyCardData[]; followUps: Array<{ applicationId: string; companyName: string; daysSinceApplied: number }> };
  week: { applications: { done: number; goal: number }; contacts: { done: number; goal: number }; followUps: { done: number; goal: number } };
};

function Goal({ label, done, goal, icon: Icon }: { label: string; done: number; goal: number; icon: typeof Target }) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  return (
    <div className="rounded-xl border bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-muted-foreground" aria-hidden /> {label}</p>
        <span className="text-sm tabular-nums"><strong>{done}</strong> / {goal}</span>
      </div>
      <Progress value={pct} className="mt-2" indicatorClassName={pct >= 100 ? "bg-success" : undefined} />
    </div>
  );
}

export function UrgencyPlan({ today, week }: Props) {
  return (
    <div className="space-y-8">
      <section className="surface p-5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Zap className="size-5 text-warning-foreground dark:text-warning" aria-hidden /> Cette semaine</h2>
        <p className="text-sm text-muted-foreground">Le mode urgence augmente intelligemment le volume, sans sacrifier la qualité : chaque cible est choisie par compatibilité.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Goal label="Candidatures ciblées" done={week.applications.done} goal={week.applications.goal} icon={Send} />
          <Goal label="Entreprises contactées" done={week.contacts.done} goal={week.contacts.goal} icon={Building2} />
          <Goal label="Relances" done={week.followUps.done} goal={week.followUps.goal} icon={RefreshCw} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Aujourd'hui</h2>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden /> {today.jobs.length} offres très compatibles à traiter</li>
          <li className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden /> {today.companies.length} entreprises à contacter (dont {Math.min(3, today.companies.filter((c) => c.activeJobsCount === 0).length)} candidatures spontanées)</li>
          <li className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden /> {today.followUps.length} relance{today.followUps.length > 1 ? "s" : ""} à envoyer</li>
        </ol>
      </section>
      <section>
        <div className="flex items-end justify-between"><h3 className="font-semibold">Offres du jour</h3><Button asChild variant="link"><Link href="/jobs?sort=match&minMatch=70">Toutes <ArrowRight /></Link></Button></div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{today.jobs.map((j) => <JobCard key={j.id} job={j} isAuthenticated />)}</div>
      </section>
      <section>
        <div className="flex items-end justify-between"><h3 className="font-semibold">Entreprises à contacter</h3><Button asChild variant="link"><Link href="/radar">Radar complet <ArrowRight /></Link></Button></div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{today.companies.map((c) => <CompanyCard key={c.id} company={c} variant="compact" isAuthenticated />)}</div>
      </section>
      {today.followUps.length ? (
        <section className="surface p-5">
          <h3 className="font-semibold">Relances du jour</h3>
          <ul className="mt-2 divide-y text-sm">
            {today.followUps.map((f) => (
              <li key={f.applicationId} className="flex items-center justify-between py-2">
                <span>{f.companyName} · sans réponse depuis {f.daysSinceApplied} jours</span>
                <Button asChild size="sm" variant="outline"><Link href={`/applications?application=${f.applicationId}`}>Relancer</Link></Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

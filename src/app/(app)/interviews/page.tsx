import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MapPin, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getApplicationsForInterview, getInterviews, type InterviewRow } from "@/features/interviews/server/queries";
import { InterviewDialog } from "@/features/interviews/components/interview-dialog";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Entretiens" };

const TYPE: Record<string, string> = { VIDEO: "Visio", PHONE: "Téléphone", ONSITE: "Sur place" };

function InterviewItem({ i }: { i: InterviewRow }) {
  return (
    <li className="surface surface-hover relative p-4">
      <Link href={`/interviews/${i.id}`} className="absolute inset-0 rounded-xl" aria-label={`Entretien chez ${i.company.name}`} />
      <div className="flex items-start gap-3">
        <CompanyLogo name={i.company.name} logoUrl={i.company.logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{i.company.name}</p>
          <p className="truncate text-sm text-muted-foreground">{i.job?.title ?? "Candidature spontanée"}</p>
          <p className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden /> {formatDateTime(i.scheduledAt)}</span>
            <span>{TYPE[i.type]}</span>
            {i.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {i.location}</span> : null}
            {i.contact ? <span>avec {i.contact.firstName} {i.contact.lastName}</span> : null}
          </p>
        </div>
        <Badge variant={i.status === "SCHEDULED" ? "info" : i.status === "DONE" ? "success" : "muted"}>{i.status === "SCHEDULED" ? "À venir" : i.status === "DONE" ? "Passé" : "Annulé"}</Badge>
      </div>
    </li>
  );
}

export default async function InterviewsPage(props: PageProps<"/interviews">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const [{ upcoming, past }, applications] = await Promise.all([getInterviews(user.id), getApplicationsForInterview(user.id)]);
  const defaultApp = typeof params["application"] === "string" ? params["application"] : null;
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Entretiens" description={`${upcoming.length} à venir · ${past.length} passé${past.length > 1 ? "s" : ""}`} actions={<InterviewDialog applications={applications} defaultApplicationId={defaultApp} defaultOpen={params["new"] === "1"} />} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">À venir</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Aucun entretien planifié" description="Quand une entreprise te propose un entretien, ajoute-le ici pour le préparer." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">{upcoming.map((i) => <InterviewItem key={i.id} i={i} />)}</ul>
        )}
      </section>
      {past.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Passés</h2>
          <ul className="grid gap-3 md:grid-cols-2">{past.map((i) => <InterviewItem key={i.id} i={i} />)}</ul>
        </section>
      ) : null}
      <div className="rounded-2xl border bg-primary-soft/40 p-5 text-sm">
        <p className="inline-flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" aria-hidden /> Préparation guidée</p>
        <p className="mt-1 text-muted-foreground">Sur chaque entretien, « Préparer mon entretien » génère un résumé de l'entreprise, les questions probables, tes points forts et les questions à poser.</p>
        <Button asChild variant="link" className="px-0"><Link href="/copilot">Ouvrir le copilote</Link></Button>
      </div>
    </PageContainer>
  );
}

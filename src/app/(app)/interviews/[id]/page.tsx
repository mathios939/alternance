import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Sparkles, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getInterview } from "@/features/interviews/server/queries";
import { InterviewNotes } from "@/features/interviews/components/interview-notes";
import { DocumentGenerator } from "@/features/copilot/components/document-generator";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { PageContainer } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Entretien" };

export default async function InterviewPage(props: PageProps<"/interviews/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const params = await props.searchParams;
  const interview = await getInterview(user.id, id);
  if (!interview) notFound();
  const lastPrep = await prisma.generatedDocument.findFirst({ where: { userId: user.id, kind: "INTERVIEW_PREP", OR: [{ applicationId: interview.applicationId ?? "" }, { companyId: interview.companyId }] }, orderBy: { createdAt: "desc" } });
  const prepare = params["prepare"] === "1";
  return (
    <PageContainer className="space-y-6">
      <Link href="/interviews" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Tous les entretiens</Link>
      <header className="surface flex flex-wrap items-start gap-4 p-5">
        <CompanyLogo name={interview.company.name} logoUrl={interview.company.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={interview.status === "SCHEDULED" ? "info" : interview.status === "DONE" ? "success" : "muted"}>{interview.status === "SCHEDULED" ? "À venir" : interview.status === "DONE" ? "Passé" : "Annulé"}</Badge>
            <Badge variant="muted">{interview.type === "VIDEO" ? "Visio" : interview.type === "PHONE" ? "Téléphone" : "Sur place"}{interview.durationMin ? ` · ${interview.durationMin} min` : ""}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Entretien chez <Link href={`/companies/${interview.company.slug}`} className="hover:underline">{interview.company.name}</Link></h1>
          <p className="text-muted-foreground">{interview.job ? <Link href={`/jobs/${interview.job.slug}`} className="hover:underline">{interview.job.title}</Link> : "Candidature spontanée"}</p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-4 text-muted-foreground" aria-hidden /> {formatDateTime(interview.scheduledAt)}</span>
            {interview.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-muted-foreground" aria-hidden /> {interview.location}</span> : null}
            {interview.contact ? <span className="inline-flex items-center gap-1"><UserRound className="size-4 text-muted-foreground" aria-hidden /> {interview.contact.firstName} {interview.contact.lastName}, {interview.contact.jobTitle}</span> : null}
          </p>
        </div>
        {!prepare ? <Button asChild size="lg"><Link href={`/interviews/${interview.id}?prepare=1`}><Sparkles /> Préparer mon entretien</Link></Button> : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="surface flex min-h-[520px] flex-col overflow-hidden">
          {prepare || lastPrep ? (
            <DocumentGenerator kind="interview_prep" params={{ interviewId: interview.id, applicationId: interview.applicationId, companySlug: interview.company.slug, jobSlug: interview.job?.slug }} contextLabel={`${interview.company.name}${interview.job ? ` · ${interview.job.title}` : ""}`} existing={lastPrep && !prepare ? { id: lastPrep.id, title: lastPrep.title, content: lastPrep.content, provider: lastPrep.provider ?? "mock", model: lastPrep.model ?? "", isDemo: lastPrep.provider === "mock" } : null} autoStart={prepare} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="size-6" aria-hidden /></span>
              <p className="font-semibold">Prépare cet entretien en 30 secondes</p>
              <p className="max-w-sm text-sm text-muted-foreground">Résumé de l'entreprise, questions probables, points à mettre en avant à partir de ton profil, questions à poser.</p>
              <Button asChild><Link href={`/interviews/${interview.id}?prepare=1`}><Sparkles /> Préparer mon entretien</Link></Button>
            </div>
          )}
        </section>
        <aside className="surface p-5">
          <h2 className="font-semibold">Mes notes</h2>
          <div className="mt-3"><InterviewNotes id={interview.id} notes={interview.notes} status={interview.status} /></div>
        </aside>
      </div>
    </PageContainer>
  );
}

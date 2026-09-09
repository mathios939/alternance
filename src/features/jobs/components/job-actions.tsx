"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ExternalLink, FileText, GitCompare, MessageSquare, PenLine, Send, Users, Check } from "lucide-react";
import type { JobDetailData } from "@/features/jobs/types";
import { APPLICATION_STATUSES } from "@/config/taxonomy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleFavorite } from "@/features/favorites/server/actions";
import { createApplication } from "@/features/applications/server/actions";
import { ReportDialog } from "@/features/reports/components/report-dialog";
import { useCompare } from "@/hooks/use-compare";

export function JobActions({ job, isAuthenticated, vertical = false }: { job: JobDetailData; isAuthenticated: boolean; vertical?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic({ isFavorite: job.isFavorite, applicationStatus: job.applicationStatus, applicationId: job.applicationId });
  const compare = useCompare();
  const inCompare = compare.has(job.id);

  function guard(): boolean {
    if (isAuthenticated) return true;
    router.push(`/register?next=${encodeURIComponent(`/jobs/${job.slug}`)}`);
    return false;
  }

  function onApply() {
    if (!guard()) return;
    startTransition(async () => {
      setState((s) => ({ ...s, applicationStatus: "TO_APPLY" }));
      const r = await createApplication({ jobId: job.id, matchScore: job.match?.total });
      if (!r.ok) toast.error(r.error);
      else toast.success(r.data.created ? "Ajoutée à tes candidatures" : "Déjà dans tes candidatures", { action: { label: "Voir le suivi", onClick: () => router.push(`/applications?application=${r.data.id}`) } });
      router.refresh();
    });
  }
  function onSave() {
    if (!guard()) return;
    startTransition(async () => {
      setState((s) => ({ ...s, isFavorite: !s.isFavorite }));
      const r = await toggleFavorite({ jobId: job.id });
      if (!r.ok) toast.error(r.error);
      else toast.success(r.data.saved ? "Sauvegardée dans tes favoris" : "Retirée des favoris");
      router.refresh();
    });
  }
  function onCompare() {
    const r = compare.toggle(job.id);
    if (r.full) toast.error(`Maximum ${compare.max} offres à comparer.`);
    else toast.success(r.added ? "Ajoutée au comparateur" : "Retirée du comparateur", r.added ? { action: { label: "Comparer", onClick: () => router.push("/compare") } } : undefined);
  }

  const status = state.applicationStatus;
  return (
    <div className={cn("flex flex-wrap gap-2", vertical && "flex-col")}>
      {status ? (
        <Button asChild variant="outline" size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
          <Link href={`/applications?application=${state.applicationId ?? ""}`}>
            <Check /> Suivi : {APPLICATION_STATUSES[status].label}
          </Link>
        </Button>
      ) : (
        <Button onClick={onApply} disabled={pending} size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
          <Send /> Candidater
        </Button>
      )}
      {job.applicationUrl && !job.isDemo ? (
        <Button asChild variant="outline" size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
          <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
            Postuler sur le site <ExternalLink />
          </a>
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => (guard() ? router.push(`/resume?job=${job.slug}`) : null)} size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
        <FileText /> Adapter mon CV
      </Button>
      <Button variant="outline" onClick={() => (guard() ? router.push(`/copilot?intent=cover_letter&job=${job.slug}`) : null)} size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
        <PenLine /> Créer une lettre
      </Button>
      <Button asChild variant="outline" size={vertical ? "lg" : "default"} className={vertical ? "w-full" : ""}>
        <Link href={`/companies/${job.company.slug}#contacts`}>
          <Users /> Contacter quelqu'un
        </Link>
      </Button>
      <div className={cn("flex gap-2", vertical && "justify-between")}>
        <Button variant={state.isFavorite ? "soft" : "ghost"} onClick={onSave} disabled={pending} aria-pressed={state.isFavorite}>
          {state.isFavorite ? <BookmarkCheck /> : <Bookmark />} {state.isFavorite ? "Sauvegardée" : "Sauvegarder"}
        </Button>
        <Button variant={inCompare ? "soft" : "ghost"} onClick={onCompare} aria-pressed={inCompare}>
          <GitCompare /> {inCompare ? "Dans le comparateur" : "Comparer"}
        </Button>
        <ReportDialog target={{ jobId: job.id }} kind="job" />
      </div>
      {job.isDemo ? (
        <p className="w-full text-xs text-muted-foreground">
          <Badge variant="warning" className="mr-1">Démo</Badge> Offre fictive : aucun envoi réel n'est possible, mais le suivi fonctionne.
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">{pending ? "Enregistrement…" : ""}</span>
      <MessageSquare className="hidden" aria-hidden />
    </div>
  );
}

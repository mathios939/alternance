"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ExternalLink, FileText, GitCompare, KanbanSquare, Mail, PenLine, Send, Users, Check } from "lucide-react";
import type { JobDetailData } from "@/features/jobs/types";
import { APPLICATION_STATUSES } from "@/config/taxonomy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleFavorite } from "@/features/favorites/server/actions";
import { createApplication } from "@/features/applications/server/actions";
import { ReportDialog } from "@/features/reports/components/report-dialog";
import { useCompare } from "@/hooks/use-compare";
import { useGuestFavorites } from "@/lib/guest/use-guest-favorites";
import { AccountPromptDialog } from "@/features/guest/components/account-prompt";

type Prompt = { title: string; description?: string } | null;

/**
 * Actions d'une offre.
 * Sans compte : « Candidater » ouvre la destination officielle (site carrières, source ou e-mail publié),
 * la sauvegarde va dans le navigateur, le comparateur fonctionne. Le suivi, le CV et les lettres
 * sont présentés comme les avantages d'un compte gratuit : jamais « vous devez vous connecter ».
 */
export function JobActions({ job, isAuthenticated, vertical = false }: { job: JobDetailData; isAuthenticated: boolean; vertical?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic({ isFavorite: job.isFavorite, applicationStatus: job.applicationStatus, applicationId: job.applicationId });
  const compare = useCompare();
  const guest = useGuestFavorites();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const inCompare = compare.has(job.id);
  const href = `/jobs/${job.slug}`;
  const size = vertical ? "lg" : "default";
  const full = vertical ? "w-full" : "";
  const officialUrl = !job.isDemo ? job.applicationUrl : null;
  const officialEmail = !job.isDemo && !officialUrl ? job.applicationEmail : null;
  const isFavorite = isAuthenticated ? state.isFavorite : guest.hasJob(job.id);

  function askAccount(title: string, description?: string): boolean {
    if (isAuthenticated) return true;
    setPrompt({ title, description });
    return false;
  }

  function onApply() {
    if (!askAccount("Crée un compte gratuitement pour sauvegarder et suivre cette candidature.", officialUrl ? "Tu peux aussi candidater directement sur le site officiel, sans compte." : undefined)) return;
    startTransition(async () => {
      setState((s) => ({ ...s, applicationStatus: "TO_APPLY" }));
      const r = await createApplication({ jobId: job.id, matchScore: job.match?.total });
      if (!r.ok) toast.error(r.error);
      else toast.success(r.data.created ? "Ajoutée à tes candidatures" : "Déjà dans tes candidatures", { action: { label: "Voir le suivi", onClick: () => router.push(`/applications?application=${r.data.id}`) } });
      router.refresh();
    });
  }
  function onSave() {
    if (!isAuthenticated) {
      const r = guest.toggleJob(job.id);
      if (r.saved) toast.success("Sauvegardée dans ce navigateur", { description: "Crée un compte gratuitement pour la retrouver sur tous tes appareils.", action: { label: "Mes favoris", onClick: () => router.push("/favorites") } });
      else toast.success("Retirée des favoris");
      return;
    }
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
        <Button asChild variant="outline" size={size} className={full}>
          <Link href={`/applications?application=${state.applicationId ?? ""}`}>
            <Check /> Suivi : {APPLICATION_STATUSES[status].label}
          </Link>
        </Button>
      ) : !isAuthenticated && officialUrl ? (
        <Button asChild size={size} className={full}>
          <a href={officialUrl} target="_blank" rel="noopener noreferrer" aria-label={`Candidater sur le site officiel : ${job.title}`}>
            <Send /> Candidater <ExternalLink />
          </a>
        </Button>
      ) : !isAuthenticated && officialEmail ? (
        <Button asChild size={size} className={full}>
          <a href={`mailto:${officialEmail}`}>
            <Mail /> Candidater par e-mail
          </a>
        </Button>
      ) : (
        <Button onClick={onApply} disabled={pending} size={size} className={full}>
          <Send /> Candidater
        </Button>
      )}
      {isAuthenticated && officialUrl ? (
        <Button asChild variant="outline" size={size} className={full}>
          <a href={officialUrl} target="_blank" rel="noopener noreferrer">
            Postuler sur le site <ExternalLink />
          </a>
        </Button>
      ) : null}
      {!isAuthenticated && !status ? (
        <Button variant="outline" size={size} className={full} onClick={onApply}>
          <KanbanSquare /> Suivre cette candidature
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => (askAccount("Crée un compte gratuitement pour adapter ton CV à cette offre.", "Ton CV est analysé et adapté à chaque offre, sans jamais inventer.") ? router.push(`/resume?job=${job.slug}`) : null)} size={size} className={full}>
        <FileText /> Adapter mon CV
      </Button>
      <Button variant="outline" onClick={() => (askAccount("Crée un compte gratuitement pour générer une lettre à partir de ton profil.", "Lettre, e-mail et message LinkedIn générés avec ton dossier, à relire avant envoi.") ? router.push(`/copilot?intent=cover_letter&job=${job.slug}`) : null)} size={size} className={full}>
        <PenLine /> Créer une lettre
      </Button>
      {!job.company.isPlaceholder ? (
        <Button asChild variant="outline" size={size} className={full}>
          <Link href={`/companies/${job.company.slug}#contacts`}>
            <Users /> Contacter quelqu'un
          </Link>
        </Button>
      ) : null}
      <div className={cn("flex gap-2", vertical && "justify-between")}>
        <Button variant={isFavorite ? "soft" : "ghost"} onClick={onSave} disabled={pending} aria-pressed={isFavorite}>
          {isFavorite ? <BookmarkCheck /> : <Bookmark />} {isFavorite ? "Sauvegardée" : "Sauvegarder"}
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
      ) : !isAuthenticated && !officialUrl && !officialEmail ? (
        <p className="w-full text-xs text-muted-foreground">Cette source ne publie pas de lien de candidature : consulte le canal indiqué dans la provenance, en bas de la fiche.</p>
      ) : null}
      <span className="sr-only" aria-live="polite">{pending ? "Enregistrement…" : ""}</span>
      {!isAuthenticated ? <AccountPromptDialog open={prompt !== null} onOpenChange={(o) => (o ? null : setPrompt(null))} title={prompt?.title ?? ""} description={prompt?.description} next={href} /> : null}
    </div>
  );
}

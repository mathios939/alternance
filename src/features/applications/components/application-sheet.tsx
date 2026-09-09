"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArrowUpRight, CalendarClock, Check, Clock, ExternalLink, FileText, MoreHorizontal, PenLine, RefreshCw, Send, Sparkles, Trash2, History } from "lucide-react";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { APPLICATION_STATUSES, APPLICATION_STATUS_KEYS } from "@/config/taxonomy";
import type { ApplicationDetailData } from "@/features/applications/types";
import { ALLOWED_TRANSITIONS } from "@/features/applications/lib/status-machine";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SkeletonText } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { archiveApplication, deleteApplication, markFollowedUp, snoozeFollowUp, updateApplicationDetails, updateApplicationStatus } from "@/features/applications/server/actions";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Ajoutée au suivi",
  STATUS_CHANGED: "Changement de statut",
  NOTE_ADDED: "Note modifiée",
  FOLLOW_UP_SENT: "Relance envoyée",
  FOLLOW_UP_SNOOZED: "Relance reportée",
  INTERVIEW_SCHEDULED: "Entretien planifié",
  DOCUMENT_GENERATED: "Document généré",
  CONTACTED: "Contact pris",
  ARCHIVED: "Archivée",
};

export function ApplicationSheet({ applicationId, onClose }: { applicationId: string | null; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ key: string; data: ApplicationDetailData | null; error: string | null } | null>(null);
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);
  const key = applicationId ? `${applicationId}:${reload}` : "";

  useEffect(() => {
    if (!applicationId) return;
    const ctrl = new AbortController();
    fetch(`/api/applications/${applicationId}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Candidature introuvable.");
        return (await r.json()) as ApplicationDetailData;
      })
      .then((d) => {
        setState({ key, data: d, error: null });
        setNotes(d.notes ?? "");
        setNextAction(d.nextAction ?? "");
        setNextActionAt(d.nextActionAt ? d.nextActionAt.slice(0, 10) : "");
      })
      .catch((e: Error) => e.name !== "AbortError" && setState({ key, data: null, error: e.message }));
    return () => ctrl.abort();
  }, [applicationId, key]);

  const data = state?.key === key ? state.data : null;
  const error = state?.key === key ? state.error : null;
  const loading = Boolean(applicationId) && !data && !error;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      else if (success) toast.success(success);
      setReload((n) => n + 1);
      router.refresh();
    });
  }

  const status = data?.status;
  const transitions = status ? [status, ...ALLOWED_TRANSITIONS[status]] : [];
  const open = Boolean(applicationId);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {error ? (
          <div className="p-6 pt-14">
            <SheetTitle className="sr-only">Erreur</SheetTitle>
            <ErrorState description={error} onRetry={() => setReload((n) => n + 1)} />
          </div>
        ) : loading || !data ? (
          <div className="p-6 pt-14">
            <SheetTitle className="sr-only">Chargement</SheetTitle>
            <SkeletonText lines={8} />
          </div>
        ) : (
          <>
            <SheetHeader className="pr-12">
              <div className="flex items-start gap-3">
                <CompanyLogo name={data.company.name} logoUrl={data.company.logoUrl} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="leading-tight">{data.job?.title ?? "Candidature spontanée"}</SheetTitle>
                  <SheetDescription>
                    <Link href={`/companies/${data.company.slug}`} className="font-medium text-foreground hover:underline">{data.company.name}</Link> · {data.company.city}
                  </SheetDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Plus d'actions"><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {data.job ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/jobs/${data.job.slug}`}><ExternalLink /> Voir l'offre</Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => run(() => archiveApplication(data.id), "Candidature archivée")}><Archive /> Archiver</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => { if (confirm("Supprimer définitivement cette candidature ?")) { run(() => deleteApplication(data.id), "Candidature supprimée"); onClose(); } }}><Trash2 /> Supprimer</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-6 pb-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="status">Statut</Label>
                  <Select value={data.status} onValueChange={(v) => run(() => updateApplicationStatus({ applicationId: data.id, status: v as ApplicationStatus }), `Statut : ${APPLICATION_STATUSES[v as ApplicationStatus].label}`)}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STATUS_KEYS.filter((s) => transitions.includes(s)).map((s) => (
                        <SelectItem key={s} value={s}>{APPLICATION_STATUSES[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="text-sm font-medium">Dates clés</p>
                  <p className="text-muted-foreground"><Clock className="mr-1 inline size-3.5" aria-hidden /> Ajoutée {formatRelative(data.createdAt)}</p>
                  {data.appliedAt ? <p className="text-muted-foreground"><Send className="mr-1 inline size-3.5" aria-hidden /> Envoyée le {formatDate(data.appliedAt)}{data.daysSinceApplied !== null ? ` (il y a ${data.daysSinceApplied} j)` : ""}</p> : null}
                  {data.lastFollowUpAt ? <p className="text-muted-foreground"><RefreshCw className="mr-1 inline size-3.5" aria-hidden /> Relancée le {formatDate(data.lastFollowUpAt)} ({data.followUpCount}×)</p> : null}
                </div>
              </div>

              {data.needsFollowUp ? (
                <div className="rounded-xl border border-warning/40 bg-warning-soft/60 p-4">
                  <p className="font-medium">Relance recommandée</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Candidature envoyée il y a {data.daysSinceApplied} jours sans réponse. Une relance courte et polie augmente nettement le taux de retour. Rien n'est envoyé sans toi.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/copilot?intent=follow_up&application=${data.id}`}><Sparkles /> Générer une relance</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run(() => markFollowedUp(data.id), "Relance enregistrée")} disabled={pending}><Check /> Marquer comme relancé</Button>
                    <Button size="sm" variant="ghost" onClick={() => run(() => snoozeFollowUp(data.id, 7), "Relance reportée de 7 jours")} disabled={pending}>Ignorer 7 jours</Button>
                  </div>
                </div>
              ) : null}

              {data.nextInterviewAt ? (
                <div className="flex items-center gap-3 rounded-xl border border-info/30 bg-info-soft/60 p-3 text-sm">
                  <CalendarClock className="size-5 text-info" aria-hidden />
                  <span className="flex-1">Entretien {formatDateTime(data.nextInterviewAt)}</span>
                  <Button asChild size="sm" variant="soft"><Link href={`/interviews/${data.interviews[0]?.id ?? ""}`}>Préparer</Link></Button>
                </div>
              ) : data.status === "INTERVIEW" ? (
                <Button asChild variant="outline" size="sm"><Link href={`/interviews?new=1&application=${data.id}`}><CalendarClock /> Planifier l'entretien</Link></Button>
              ) : null}

              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="nextAction">Prochaine action</Label>
                    <Input id="nextAction" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ex : relancer Marie par LinkedIn" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nextActionAt">Échéance</Label>
                    <Input id="nextActionAt" type="date" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contact, échanges, points à retenir…" className="min-h-24" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Interlocuteur</Label>
                    <Select value={data.contact?.id ?? "none"} onValueChange={(v) => run(() => updateApplicationDetails({ applicationId: data.id, contactId: v === "none" ? null : v }))}>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {data.availableContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} · {c.jobTitle}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>CV utilisé</Label>
                    <Select value={data.resume?.id ?? "none"} onValueChange={(v) => run(() => updateApplicationDetails({ applicationId: data.id, resumeId: v === "none" ? null : v }))}>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {data.availableResumes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={() => run(() => updateApplicationDetails({ applicationId: data.id, notes, nextAction, nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null }), "Enregistré")} loading={pending}>Enregistrer</Button>
              </div>

              <Separator />
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-muted-foreground" aria-hidden /> Documents</p>
                {data.documents.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document généré pour cette candidature.</p> : (
                  <ul className="space-y-1.5">
                    {data.documents.map((d) => (
                      <li key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="truncate">{d.title}</span>
                        <Link href={`/copilot?document=${d.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ouvrir <ArrowUpRight className="size-3" aria-hidden /></Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/copilot?intent=cover_letter&application=${data.id}`}><PenLine /> Lettre de motivation</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/copilot?intent=email&application=${data.id}`}><Send /> Email de candidature</Link></Button>
                </div>
              </div>

              <Separator />
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-muted-foreground" aria-hidden /> Historique</p>
                <ol className="space-y-2 border-l pl-4">
                  {data.events.map((e) => (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border bg-card" aria-hidden />
                      <span>{EVENT_LABEL[e.type] ?? e.type}</span>
                      {e.type === "STATUS_CHANGED" && e.toStatus ? <Badge variant="muted" className="ml-2 font-normal">{e.fromStatus ? `${APPLICATION_STATUSES[e.fromStatus].short} → ` : ""}{APPLICATION_STATUSES[e.toStatus].short}</Badge> : null}
                      <span className="block text-xs text-muted-foreground">{formatRelative(e.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

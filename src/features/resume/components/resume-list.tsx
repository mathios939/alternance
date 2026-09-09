"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MoreHorizontal, Plus, Star, Trash2, PenLine } from "lucide-react";
import type { ResumeSummary } from "@/features/resume/server/queries";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createResume, deleteResume, renameResume, setDefaultResume } from "@/features/resume/server/actions";

export function ResumeList({ resumes, selectedId }: { resumes: ResumeSummary[]; selectedId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "rename"; id: string; title: string } | null>(null);
  const [title, setTitle] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      else if (msg) toast.success(msg);
      router.refresh();
    });
  }

  function submitDialog() {
    if (!dialog) return;
    if (dialog.mode === "create") {
      startTransition(async () => {
        const r = await createResume({ title });
        if (!r.ok) toast.error(r.error);
        else {
          setDialog(null);
          router.push(`/resume?resume=${r.data.id}`);
          router.refresh();
        }
      });
    } else {
      run(() => renameResume(dialog.id, title), "Renommé");
      setDialog(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Mes CV</p>
        <Button size="sm" variant="ghost" onClick={() => { setTitle(""); setDialog({ mode: "create" }); }}>
          <Plus /> Nouveau
        </Button>
      </div>
      <ul className="space-y-1.5">
        {resumes.map((r) => (
          <li key={r.id} className={cn("group flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 transition-colors", r.id === selectedId ? "border-primary ring-2 ring-primary/20" : "hover:border-foreground/20")}>
            <Link href={`/resume?resume=${r.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.title}{r.isDefault ? <Star className="ml-1 inline size-3 fill-warning text-warning" aria-label="Par défaut" /> : null}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.latest ? `v${r.latest.version} · ${r.latest.score !== null ? `${r.latest.score}/100` : "non analysé"} · ${formatRelative(r.latest.createdAt)}` : "Aucun fichier"}</span>
              </span>
            </Link>
            {r.latest?.score !== null && r.latest?.score !== undefined ? <Badge variant={r.latest.score >= 80 ? "success" : r.latest.score >= 60 ? "soft" : "warning"} className="tabular-nums">{r.latest.score}</Badge> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setTitle(r.title); setDialog({ mode: "rename", id: r.id, title: r.title }); }}><PenLine /> Renommer</DropdownMenuItem>
                {!r.isDefault ? <DropdownMenuItem onClick={() => run(() => setDefaultResume(r.id), "CV par défaut mis à jour")}><Star /> Définir par défaut</DropdownMenuItem> : null}
                <DropdownMenuItem variant="destructive" onClick={() => { if (confirm(`Supprimer « ${r.title} » et toutes ses versions ?`)) run(() => deleteResume(r.id), "CV supprimé"); }}><Trash2 /> Supprimer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dialog?.mode === "create" ? "Nouveau CV" : "Renommer le CV"}</DialogTitle></DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CV Développement, CV Data, CV Cybersécurité…" autoFocus onKeyDown={(e) => e.key === "Enter" && submitDialog()} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Annuler</Button>
            <Button onClick={submitDialog} disabled={title.trim().length < 2} loading={pending}>{dialog?.mode === "create" ? "Créer" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

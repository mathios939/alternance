"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, MoveRight, StickyNote, Trash2 } from "lucide-react";
import type { FavoriteCollection } from "@/generated/prisma/enums";
import { FAVORITE_COLLECTIONS } from "@/config/taxonomy";
import type { FavoriteEntry } from "@/features/favorites/server/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";
import { toggleFavorite, updateFavoriteNote } from "@/features/favorites/server/actions";
import Link from "next/link";

const ORDER: FavoriteCollection[] = ["PRIORITY", "TO_APPLY", "COMPANIES", "WATCH"];

function FavoriteItem({ entry }: { entry: FavoriteEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(entry.note ?? "");
  const [editing, setEditing] = useState(false);
  const target = entry.job ? { jobId: entry.job.id } : entry.company ? { companyId: entry.company.id } : null;

  function move(collection: FavoriteCollection) {
    if (!target) return;
    startTransition(async () => {
      const r = await toggleFavorite({ ...target, collection });
      if (!r.ok) toast.error(r.error);
      else toast.success(`Déplacé vers « ${FAVORITE_COLLECTIONS[collection].label} »`);
      router.refresh();
    });
  }
  function remove() {
    if (!target) return;
    startTransition(async () => {
      const r = await toggleFavorite(target);
      if (!r.ok) toast.error(r.error);
      else toast.success("Retiré des favoris");
      router.refresh();
    });
  }
  function saveNote() {
    startTransition(async () => {
      const r = await updateFavoriteNote(entry.id, note);
      if (!r.ok) toast.error(r.error);
      else setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {entry.job ? <JobCard job={entry.job} isAuthenticated /> : entry.company ? <CompanyCard company={entry.company} isAuthenticated /> : null}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={pending}>
              <MoveRight /> Déplacer
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Collection</DropdownMenuLabel>
            {ORDER.filter((c) => c !== entry.collection).map((c) => (
              <DropdownMenuItem key={c} onClick={() => move(c)}>
                {FAVORITE_COLLECTIONS[c].emoji} {FAVORITE_COLLECTIONS[c].label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 /> Retirer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
          <StickyNote /> {entry.note ? "Note" : "Ajouter une note"}
        </Button>
        {entry.note && !editing ? <p className="truncate text-xs text-muted-foreground">« {entry.note} »</p> : null}
      </div>
      {editing ? (
        <div className="flex gap-2 px-1">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" placeholder="Pourquoi cette offre t'intéresse, ce qu'il faut vérifier…" maxLength={500} />
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={saveNote} loading={pending}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FavoritesBoard({ entries }: { entries: FavoriteEntry[] }) {
  const counts = Object.fromEntries(ORDER.map((c) => [c, entries.filter((e) => e.collection === c).length])) as Record<FavoriteCollection, number>;
  const first = ORDER.find((c) => counts[c] > 0) ?? "PRIORITY";
  return (
    <Tabs defaultValue={first}>
      <TabsList className="h-auto flex-wrap">
        {ORDER.map((c) => (
          <TabsTrigger key={c} value={c} className="gap-1.5">
            <span aria-hidden>{FAVORITE_COLLECTIONS[c].emoji}</span> {FAVORITE_COLLECTIONS[c].label}
            <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{counts[c]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {ORDER.map((c) => {
        const list = entries.filter((e) => e.collection === c);
        return (
          <TabsContent key={c} value={c}>
            <p className="mb-4 text-sm text-muted-foreground">{FAVORITE_COLLECTIONS[c].description}</p>
            {list.length === 0 ? (
              <EmptyState icon={Bookmark} title={`Rien dans « ${FAVORITE_COLLECTIONS[c].label} »`} description={c === "COMPANIES" ? "Suis des entreprises depuis leur fiche ou le Radar." : "Sauvegarde des offres depuis la recherche pour les retrouver ici."} action={<Button asChild variant="outline"><Link href={c === "COMPANIES" ? "/radar" : "/jobs"}>{c === "COMPANIES" ? "Ouvrir le Radar" : "Chercher des offres"}</Link></Button>} />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {list.map((e) => (
                  <FavoriteItem key={e.id} entry={e} />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, FolderKanban, GraduationCap, Plus, Trash2 } from "lucide-react";
import type { EducationLevel } from "@/generated/prisma/enums";
import { EDUCATION_LEVELS, EDUCATION_LEVEL_KEYS } from "@/config/taxonomy";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkillsInput } from "@/components/shared/skills-input";
import { addEducation, addExperience, addProject, deleteEducation, deleteExperience, deleteProject } from "@/features/settings/server/actions";

type Experience = { id: string; title: string; company: string; startDate: Date | null; endDate: Date | null; current: boolean; description: string | null; skills: string[] };
type Education = { id: string; title: string; school: string; level: EducationLevel | null; startYear: number | null; endYear: number | null; current: boolean };
type Project = { id: string; name: string; description: string | null; url: string | null; skills: string[] };

export function ProfileExtras({ experiences, educations, projects }: { experiences: Experience[]; educations: Education[]; projects: Project[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      else toast.success(msg);
      router.refresh();
    });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-semibold"><Briefcase className="size-4 text-muted-foreground" aria-hidden /> Expériences</h2>
          <ExperienceDialog />
        </div>
        <ul className="mt-3 space-y-2">
          {experiences.length === 0 ? <li className="text-sm text-muted-foreground">Stages, jobs, bénévolat : tout compte.</li> : null}
          {experiences.map((e) => (
            <li key={e.id} className="group rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-muted-foreground">{e.company}{e.startDate ? ` · ${formatDate(e.startDate, "MMM yyyy")}` : ""}{e.current ? " – aujourd'hui" : e.endDate ? ` – ${formatDate(e.endDate, "MMM yyyy")}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Supprimer" disabled={pending} onClick={() => run(() => deleteExperience(e.id), "Expérience supprimée")}><Trash2 /></Button>
              </div>
              {e.description ? <p className="mt-1 text-xs text-muted-foreground">{e.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-semibold"><GraduationCap className="size-4 text-muted-foreground" aria-hidden /> Formations</h2>
          <EducationDialog />
        </div>
        <ul className="mt-3 space-y-2">
          {educations.length === 0 ? <li className="text-sm text-muted-foreground">Ajoute ta formation actuelle et le bac.</li> : null}
          {educations.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{e.title}{e.level ? <span className="ml-1 text-xs text-muted-foreground">({EDUCATION_LEVELS[e.level].short})</span> : null}</p>
                <p className="text-muted-foreground">{e.school}{e.startYear ? ` · ${e.startYear}` : ""}{e.current ? " – en cours" : e.endYear ? ` – ${e.endYear}` : ""}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Supprimer" disabled={pending} onClick={() => run(() => deleteEducation(e.id), "Formation supprimée")}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-semibold"><FolderKanban className="size-4 text-muted-foreground" aria-hidden /> Projets</h2>
          <ProjectDialog />
        </div>
        <ul className="mt-3 space-y-2">
          {projects.length === 0 ? <li className="text-sm text-muted-foreground">Projets scolaires ou personnels : très valorisés en alternance.</li> : null}
          {projects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{p.name}</p>
                {p.description ? <p className="text-xs text-muted-foreground">{p.description}</p> : null}
                {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{p.url}</a> : null}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Supprimer" disabled={pending} onClick={() => run(() => deleteProject(p.id), "Projet supprimé")}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExperienceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ title: "", company: "", startDate: "", endDate: "", current: false, description: "", skills: [] as string[] });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Plus /> Ajouter</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle expérience</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="exp-title">Intitulé</Label><Input id="exp-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Stage développeuse web" /></div>
            <div className="space-y-1.5"><Label htmlFor="exp-company">Entreprise</Label><Input id="exp-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="exp-start">Début</Label><Input id="exp-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="exp-end">Fin</Label><Input id="exp-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={form.current} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.current} onCheckedChange={(v) => setForm({ ...form, current: v === true })} /> En cours</label>
          <div className="space-y-1.5"><Label htmlFor="exp-desc">Ce que tu as fait (avec un résultat si possible)</Label><Textarea id="exp-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20" /></div>
          <div className="space-y-1.5"><Label>Compétences utilisées</Label><SkillsInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} max={15} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button loading={pending} disabled={form.title.length < 2 || !form.company} onClick={() => startTransition(async () => { const r = await addExperience({ ...form, startDate: form.startDate || null, endDate: form.current ? null : form.endDate || null }); if (!r.ok) toast.error(r.error); else { toast.success("Expérience ajoutée"); setOpen(false); setForm({ title: "", company: "", startDate: "", endDate: "", current: false, description: "", skills: [] }); router.refresh(); } })}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EducationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ title: "", school: "", level: "" as EducationLevel | "", startYear: "", endYear: "", current: true });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Plus /> Ajouter</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="edu-title">Diplôme / formation</Label><Input id="edu-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="BTS SIO option SLAM" /></div>
          <div className="space-y-1.5"><Label htmlFor="edu-school">École</Label><Input id="edu-school" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Niveau</Label>
            <Select value={form.level || "none"} onValueChange={(v) => setForm({ ...form, level: v === "none" ? "" : (v as EducationLevel) })}>
              <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Non précisé</SelectItem>{EDUCATION_LEVEL_KEYS.map((k) => <SelectItem key={k} value={k}>{EDUCATION_LEVELS[k].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="edu-start">Année de début</Label><Input id="edu-start" type="number" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="edu-end">Année de fin</Label><Input id="edu-end" type="number" value={form.endYear} onChange={(e) => setForm({ ...form, endYear: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.current} onCheckedChange={(v) => setForm({ ...form, current: v === true })} /> En cours</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button loading={pending} disabled={form.title.length < 2 || !form.school} onClick={() => startTransition(async () => { const r = await addEducation({ title: form.title, school: form.school, level: form.level || null, startYear: form.startYear ? Number(form.startYear) : null, endYear: form.endYear ? Number(form.endYear) : null, current: form.current }); if (!r.ok) toast.error(r.error); else { toast.success("Formation ajoutée"); setOpen(false); router.refresh(); } })}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", description: "", url: "", skills: [] as string[] });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Plus /> Ajouter</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau projet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="pr-name">Nom</Label><Input id="pr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="pr-desc">Description (contexte, ce que tu as fait, résultat)</Label><Textarea id="pr-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20" /></div>
          <div className="space-y-1.5"><Label htmlFor="pr-url">Lien (GitHub, site…)</Label><Input id="pr-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>
          <div className="space-y-1.5"><Label>Compétences</Label><SkillsInput value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} max={15} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button loading={pending} disabled={form.name.length < 2} onClick={() => startTransition(async () => { const r = await addProject(form); if (!r.ok) toast.error(r.error); else { toast.success("Projet ajouté"); setOpen(false); setForm({ name: "", description: "", url: "", skills: [] }); router.refresh(); } })}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

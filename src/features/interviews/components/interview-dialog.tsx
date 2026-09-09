"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { InterviewType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInterview } from "@/features/interviews/server/actions";

const TYPES: Record<InterviewType, string> = { VIDEO: "Visioconférence", PHONE: "Téléphone", ONSITE: "Sur place" };

export function InterviewDialog({ applications, defaultApplicationId, defaultOpen = false }: { applications: Array<{ id: string; label: string }>; defaultApplicationId?: string | null; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ applicationId: defaultApplicationId ?? applications[0]?.id ?? "", scheduledAt: "", durationMin: 45, type: "VIDEO" as InterviewType, location: "", notes: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Planifier un entretien</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planifier un entretien</DialogTitle>
          <DialogDescription>La candidature passera automatiquement en « Entretien ».</DialogDescription>
        </DialogHeader>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune candidature envoyée pour le moment. Envoie d'abord une candidature depuis le suivi.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Candidature</Label>
              <Select value={form.applicationId} onValueChange={(v) => setForm({ ...form, applicationId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{applications.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="itv-date">Date et heure</Label><Input id="itv-date" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="itv-duration">Durée (min)</Label><Input id="itv-duration" type="number" min={10} max={480} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Format</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as InterviewType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPES) as InterviewType[]).map((t) => <SelectItem key={t} value={t}>{TYPES[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="itv-loc">Lieu / lien</Label><Input id="itv-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Adresse ou lien visio" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="itv-notes">Notes</Label><Textarea id="itv-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-16" /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button loading={pending} disabled={!form.applicationId || !form.scheduledAt} onClick={() => startTransition(async () => { const r = await createInterview({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }); if (!r.ok) toast.error(r.error); else { toast.success("Entretien planifié"); setOpen(false); router.push(`/interviews/${r.data.id}`); router.refresh(); } })}>Planifier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

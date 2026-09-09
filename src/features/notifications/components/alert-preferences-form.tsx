"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DigestFrequency } from "@/generated/prisma/enums";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { updateAlertPreference, type AlertPreferenceInput } from "@/features/notifications/server/actions";

const ROWS: Array<{ key: keyof Pick<AlertPreferenceInput, "newJobs" | "highMatchJobs" | "followUps" | "newCompanies" | "interviewReminders">; label: string; help: string }> = [
  { key: "highMatchJobs", label: "Offre très compatible", help: "Quand une nouvelle offre dépasse ton seuil de compatibilité." },
  { key: "newJobs", label: "Nouvelles offres", help: "Résumé des nouvelles offres dans ta zone." },
  { key: "followUps", label: "Relance à faire", help: "Une candidature attend depuis 7 jours." },
  { key: "newCompanies", label: "Nouvelle entreprise", help: "Le Radar repère une entreprise pertinente." },
  { key: "interviewReminders", label: "Rappel d'entretien", help: "La veille et le jour même." },
];

export function AlertPreferencesForm({ initial }: { initial: AlertPreferenceInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <h2 className="font-semibold">Canaux</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"><span>Dans l'application</span><Switch checked={form.inAppEnabled} onCheckedChange={(v) => setForm({ ...form, inAppEnabled: v })} /></label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"><span>Email</span><Switch checked={form.emailEnabled} onCheckedChange={(v) => setForm({ ...form, emailEnabled: v })} /></label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-muted-foreground"><span>Push <span className="text-xs">(bientôt)</span></span><Switch checked={form.pushEnabled} onCheckedChange={(v) => setForm({ ...form, pushEnabled: v })} disabled /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fréquence du résumé email</Label>
            <Select value={form.digestFrequency} onValueChange={(v) => setForm({ ...form, digestFrequency: v as DigestFrequency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="DAILY">Quotidien</SelectItem><SelectItem value="WEEKLY">Hebdomadaire</SelectItem><SelectItem value="NONE">Jamais</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Seuil « très compatible »</Label><span className="text-sm tabular-nums">{form.minMatchScore} %</span></div>
            <Slider min={50} max={95} step={5} value={[form.minMatchScore]} onValueChange={(v) => setForm({ ...form, minMatchScore: v[0] ?? 70 })} aria-label="Seuil de compatibilité" />
          </div>
        </div>
      </section>
      <section className="surface p-5">
        <h2 className="font-semibold">Types d'alertes</h2>
        <ul className="mt-3 divide-y">
          {ROWS.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.help}</p></div>
              <Switch checked={form[r.key]} onCheckedChange={(v) => setForm({ ...form, [r.key]: v })} aria-label={r.label} />
            </li>
          ))}
        </ul>
      </section>
      <div className="flex justify-end">
        <Button loading={pending} onClick={() => startTransition(async () => { const r = await updateAlertPreference(form); if (!r.ok) toast.error(r.error); else toast.success("Préférences enregistrées"); router.refresh(); })}>Enregistrer</Button>
      </div>
    </div>
  );
}

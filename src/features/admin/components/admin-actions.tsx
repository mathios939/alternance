"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, EyeOff, Eye, RefreshCw, Trash2, X, Ban } from "lucide-react";
import type { Plan, ReportStatus, UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteContactAdmin, deleteJobAdmin, optOutContact, resolveReport, setJobActive, setSourceEnabled, syncSource, updateCompanyFlags, updateUserAdmin } from "@/features/admin/server/actions";

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      else if (msg) toast.success(msg);
      router.refresh();
    });
  return { pending, run };
}

export function JobRowActions({ jobId, isActive }: { jobId: string; isActive: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={isActive ? "Désactiver" : "Activer"} onClick={() => run(() => setJobActive(jobId, !isActive), isActive ? "Offre désactivée" : "Offre activée")}>{isActive ? <EyeOff /> : <Eye />}</Button>
      <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Supprimer" onClick={() => { if (confirm("Supprimer définitivement cette offre ?")) run(() => deleteJobAdmin(jobId), "Offre supprimée"); }}><Trash2 /></Button>
    </div>
  );
}

export function CompanyFlags({ companyId, hiresApprentices, isHiring }: { companyId: string; hiresApprentices: boolean; isHiring: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex items-center gap-4 text-xs">
      <label className="flex items-center gap-1.5">Alternants <Switch checked={hiresApprentices} disabled={pending} onCheckedChange={(v) => run(() => updateCompanyFlags(companyId, { hiresApprentices: v }))} aria-label="Accueille des alternants" /></label>
      <label className="flex items-center gap-1.5">Recrute <Switch checked={isHiring} disabled={pending} onCheckedChange={(v) => run(() => updateCompanyFlags(companyId, { isHiring: v }))} aria-label="Recrute" /></label>
    </div>
  );
}

export function UserControls({ userId, role, plan }: { userId: string; role: UserRole; plan: Plan }) {
  const { pending, run } = useRun();
  return (
    <div className="flex gap-2">
      <Select value={role} onValueChange={(v) => run(() => updateUserAdmin(userId, { role: v as UserRole }), "Rôle mis à jour")} disabled={pending}>
        <SelectTrigger size="sm" className="w-28" aria-label="Rôle"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="USER">Utilisateur</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
      </Select>
      <Select value={plan} onValueChange={(v) => run(() => updateUserAdmin(userId, { plan: v as Plan }), "Plan mis à jour")} disabled={pending}>
        <SelectTrigger size="sm" className="w-28" aria-label="Plan"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="FREE">Gratuit</SelectItem><SelectItem value="PREMIUM">Premium</SelectItem></SelectContent>
      </Select>
    </div>
  );
}

export function ReportActions({ reportId, status }: { reportId: string; status: ReportStatus }) {
  const { pending, run } = useRun();
  if (status !== "OPEN") return <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => resolveReport(reportId, "OPEN"), "Signalement rouvert")}>Rouvrir</Button>;
  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => resolveReport(reportId, "RESOLVED"), "Signalement traité")}><Check /> Traiter</Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => resolveReport(reportId, "DISMISSED"), "Signalement rejeté")}><X /> Rejeter</Button>
    </div>
  );
}

export function ContactActions({ contactId, optedOut }: { contactId: string; optedOut: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex justify-end gap-1">
      <Button variant={optedOut ? "soft" : "ghost"} size="sm" disabled={pending} onClick={() => run(() => optOutContact(contactId, !optedOut), optedOut ? "Contact réactivé" : "Droit d'opposition appliqué")}><Ban /> {optedOut ? "Opposition active" : "Opposition"}</Button>
      <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Supprimer" onClick={() => { if (confirm("Supprimer définitivement ce contact ?")) run(() => deleteContactAdmin(contactId), "Contact supprimé"); }}><Trash2 /></Button>
    </div>
  );
}

export function SourceActions({ sourceId, sourceKey, isEnabled, configured }: { sourceId: string; sourceKey: string; isEnabled: boolean; configured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="flex items-center justify-end gap-3">
      <label className="flex items-center gap-1.5 text-xs">Activée <Switch checked={isEnabled} disabled={pending} onCheckedChange={(v) => startTransition(async () => { const r = await setSourceEnabled(sourceId, v); if (!r.ok) toast.error(r.error); router.refresh(); })} aria-label="Source activée" /></label>
      <Button variant="outline" size="sm" disabled={!configured || syncing} loading={syncing} onClick={() => { setSyncing(true); startTransition(async () => { const r = await syncSource(sourceKey); setSyncing(false); if (!r.ok) toast.error(r.error); else toast.success(`Synchro : ${r.data.fetched} reçues, ${r.data.created} créées, ${r.data.updated} mises à jour, ${r.data.duplicates} doublons${r.data.errors.length ? `, ${r.data.errors.length} erreur(s)` : ""}`); router.refresh(); }); }} title={configured ? "Lancer la synchronisation" : "Source non configurée (voir .env.example)"}>
        {!syncing ? <RefreshCw /> : null} Synchroniser
      </Button>
    </div>
  );
}

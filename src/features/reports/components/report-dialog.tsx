"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import type { ReportReason } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChipSelect } from "@/components/shared/chip-select";
import { createReport } from "@/features/reports/server/actions";

const REASONS: Array<{ value: ReportReason; label: string; scope: Array<"job" | "company" | "contact"> }> = [
  { value: "JOB_EXPIRED", label: "Offre expirée", scope: ["job"] },
  { value: "FAKE_JOB", label: "Fausse offre", scope: ["job"] },
  { value: "INCORRECT_INFO", label: "Information incorrecte", scope: ["job", "company", "contact"] },
  { value: "INCORRECT_CONTACT", label: "Contact incorrect", scope: ["contact", "company"] },
  { value: "INCORRECT_COMPANY", label: "Entreprise incorrecte", scope: ["company", "job"] },
];

type Props = { target: { jobId?: string; companyId?: string; contactId?: string }; kind: "job" | "company" | "contact"; trigger?: React.ReactNode };

export function ReportDialog({ target, kind, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const options = REASONS.filter((r) => r.scope.includes(kind));

  function submit() {
    if (!reason) return;
    startTransition(async () => {
      const result = await createReport({ reason, details, ...target });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Merci, le signalement a été transmis.");
      setOpen(false);
      setReason(null);
      setDetails("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag /> Signaler
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un problème</DialogTitle>
          <DialogDescription>Ton signalement nous aide à garder des données fiables. Il est traité manuellement.</DialogDescription>
        </DialogHeader>
        <ChipSelect aria-label="Motif du signalement" size="sm" options={options.map((o) => ({ value: o.value, label: o.label }))} value={reason} onChange={(v) => setReason(v as ReportReason | null)} />
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Précisions (optionnel)" className="min-h-20" maxLength={1000} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!reason} loading={pending}>Envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

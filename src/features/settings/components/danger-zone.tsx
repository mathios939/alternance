"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteAccount } from "@/features/settings/server/actions";

export function ExportDataButton() {
  return (
    <Button asChild variant="outline">
      <a href="/api/account/export" download><Download /> Exporter mes données (JSON)</a>
    </Button>
  );
}

export function DeleteAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 /> Supprimer mon compte</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" aria-hidden /> Supprimer définitivement ton compte</DialogTitle>
          <DialogDescription>Profil, CV, candidatures, favoris, conversations et documents seront effacés immédiatement et sans retour possible. Pense à exporter tes données avant.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm">Tape <strong>SUPPRIMER</strong> pour confirmer.</p>
          <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="SUPPRIMER" aria-label="Confirmation" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="destructive" loading={pending} disabled={confirmation.trim().toUpperCase() !== "SUPPRIMER"} onClick={() => startTransition(async () => { const r = await deleteAccount(confirmation); if (!r.ok) { toast.error(r.error); return; } toast.success("Compte supprimé. À bientôt peut-être."); router.push("/"); router.refresh(); })}>Supprimer définitivement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

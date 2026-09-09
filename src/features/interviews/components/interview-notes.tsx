"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import type { InterviewStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteInterview, updateInterview } from "@/features/interviews/server/actions";

export function InterviewNotes({ id, notes, status }: { id: string; notes: string | null; status: InterviewStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();
  function run(input: Parameters<typeof updateInterview>[1], msg: string) {
    startTransition(async () => {
      const r = await updateInterview(id, input);
      if (!r.ok) toast.error(r.error);
      else toast.success(msg);
      router.refresh();
    });
  }
  return (
    <div className="space-y-3">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Points à retenir, questions posées, impressions, prochaines étapes…" className="min-h-32" aria-label="Notes d'entretien" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" loading={pending} onClick={() => run({ notes: value }, "Notes enregistrées")}>Enregistrer les notes</Button>
        {status === "SCHEDULED" ? (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ status: "DONE" }, "Entretien marqué comme passé")}><Check /> Entretien passé</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run({ status: "CANCELLED" }, "Entretien annulé")}><X /> Annulé</Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={pending} onClick={() => { if (confirm("Supprimer cet entretien ?")) startTransition(async () => { const r = await deleteInterview(id); if (!r.ok) toast.error(r.error); else { router.push("/interviews"); router.refresh(); } }); }}><Trash2 /> Supprimer</Button>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RefreshCw, Sparkles } from "lucide-react";
import type { BoardData } from "@/features/applications/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markFollowedUp, snoozeFollowUp } from "@/features/applications/server/actions";

export function FollowUpsPanel({ followUps, highlight }: { followUps: BoardData["followUps"]; highlight?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (followUps.length === 0) return null;
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      else toast.success(msg);
      router.refresh();
    });
  }
  return (
    <section className={`surface p-5 ${highlight ? "ring-2 ring-warning/50" : ""}`} aria-labelledby="followups-title">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning-foreground dark:text-warning"><RefreshCw className="size-4" aria-hidden /></span>
        <div>
          <h2 id="followups-title" className="font-semibold">{followUps.length} relance{followUps.length > 1 ? "s" : ""} recommandée{followUps.length > 1 ? "s" : ""}</h2>
          <p className="text-xs text-muted-foreground">Sans réponse depuis 7 jours ou plus. Rien n'est envoyé automatiquement.</p>
        </div>
      </div>
      <ul className="mt-4 divide-y">
        {followUps.map((f) => (
          <li key={f.applicationId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {f.companyName}
                {f.urgency === "high" ? <Badge variant="warning" className="ml-2">Urgent</Badge> : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {f.jobTitle ?? "Candidature spontanée"} · envoyée il y a {f.daysSinceApplied} jours{f.followUpCount > 0 ? ` · déjà ${f.followUpCount} relance${f.followUpCount > 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm"><Link href={`/copilot?intent=follow_up&application=${f.applicationId}`}><Sparkles /> Générer une relance</Link></Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markFollowedUp(f.applicationId), "Relance enregistrée")}><Check /> Relancé</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => snoozeFollowUp(f.applicationId, 7), "Reporté de 7 jours")}>Ignorer</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

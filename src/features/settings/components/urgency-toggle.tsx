"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toggleUrgencyMode } from "@/features/onboarding/server/actions";

export function UrgencyToggle({ enabled, weeklyGoal }: { enabled: boolean; weeklyGoal: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label id="goal" className="flex items-center gap-3 rounded-xl border px-4 py-3">
      <Zap className="size-5 text-warning-foreground dark:text-warning" aria-hidden />
      <span className="text-sm">
        <span className="block font-medium">Mode urgence</span>
        <span className="block text-xs text-muted-foreground">Objectif : {weeklyGoal} candidatures / semaine</span>
      </span>
      <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => startTransition(async () => { const r = await toggleUrgencyMode(v); if (!r.ok) toast.error(r.error); else toast.success(v ? "Mode urgence activé" : "Mode urgence désactivé"); router.refresh(); })} aria-label="Mode urgence" />
    </label>
  );
}

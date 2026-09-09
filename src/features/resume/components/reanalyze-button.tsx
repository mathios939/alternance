"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reanalyzeResume } from "@/features/resume/server/actions";

export function ReanalyzeButton({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => startTransition(async () => { const r = await reanalyzeResume(resumeId); if (!r.ok) toast.error(r.error); else { toast.success(`Analyse mise à jour : ${r.data.score}/100`); router.refresh(); } })}>
      {!pending ? <RefreshCw /> : null} Ré-analyser
    </Button>
  );
}

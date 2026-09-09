"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, RefreshCw, Target, X, Zap } from "lucide-react";
import type { DailyActionType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import type { DailyActionView } from "@/features/dashboard/server/queries";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { completeDailyAction, regenerateDailyMission, skipDailyAction } from "@/features/dashboard/server/actions";

const TYPE_LABEL: Record<DailyActionType, string> = {
  APPLY_JOB: "Candidater",
  CONTACT_COMPANY: "Contacter",
  FOLLOW_UP: "Relancer",
  UPDATE_RESUME: "CV",
  COMPLETE_PROFILE: "Profil",
  PREPARE_INTERVIEW: "Entretien",
  SAVE_JOB: "Explorer",
};

export function DailyMission({ actions, urgencyMode }: { actions: DailyActionView[]; urgencyMode: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visible = actions.filter((a) => !a.skippedAt);
  const done = visible.filter((a) => a.completedAt).length;
  const percent = visible.length ? Math.round((done / visible.length) * 100) : 0;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Erreur");
      router.refresh();
    });
  }

  return (
    <section className="surface relative overflow-hidden p-5 sm:p-6" aria-labelledby="mission-title">
      <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary uppercase">
            {urgencyMode ? <Zap className="size-3.5" aria-hidden /> : <Target className="size-3.5" aria-hidden />}
            {urgencyMode ? "Mode urgence" : "Ta mission aujourd'hui"}
          </p>
          <h2 id="mission-title" className="mt-1 text-xl font-semibold">
            {visible.length === 0 ? "Rien d'urgent aujourd'hui" : done === visible.length ? "Mission accomplie 🎉" : `${visible.length - done} action${visible.length - done > 1 ? "s" : ""} pour avancer`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums">
            {done}/{visible.length}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => run(regenerateDailyMission)} disabled={pending} aria-label="Régénérer la mission">
            <RefreshCw className={cn(pending && "animate-spin")} />
          </Button>
        </div>
      </div>
      <Progress value={percent} className="relative mt-4" aria-label="Progression de la mission du jour" />
      {visible.length === 0 ? (
        <p className="relative mt-4 text-sm text-muted-foreground">
          Ton profil est à jour et rien n'attend de réponse. Explore les{" "}
          <Link href="/jobs?sort=match" className="font-medium text-primary hover:underline">
            offres les plus compatibles
          </Link>{" "}
          ou le <Link href="/radar" className="font-medium text-primary hover:underline">Radar</Link>.
        </p>
      ) : (
        <ol className="relative mt-4 space-y-2">
          {visible.map((a, i) => {
            const isDone = Boolean(a.completedAt);
            return (
              <li key={a.id} className={cn("group flex items-start gap-3 rounded-xl border bg-card/80 p-3 transition-colors", isDone ? "opacity-60" : "hover:border-foreground/20")}>
                <button
                  type="button"
                  onClick={() => run(() => completeDailyAction(a.id, !isDone))}
                  disabled={pending}
                  aria-pressed={isDone}
                  aria-label={isDone ? "Marquer comme à faire" : "Marquer comme fait"}
                  className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", isDone ? "border-success bg-success text-success-foreground" : "border-input hover:border-primary")}
                >
                  {isDone ? <Check className="size-3.5" strokeWidth={3} /> : <span className="text-[10px] font-semibold text-muted-foreground">{i + 1}</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("font-medium", isDone && "line-through")}>{a.title}</p>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{TYPE_LABEL[a.type]}</span>
                  </div>
                  {a.description ? <p className="text-sm text-muted-foreground">{a.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isDone && a.href ? (
                    <Button asChild size="sm" variant="soft">
                      <Link href={a.href}>
                        Faire <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                  {!isDone ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => run(() => skipDailyAction(a.id))} disabled={pending} aria-label="Ignorer cette action" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                      <X />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

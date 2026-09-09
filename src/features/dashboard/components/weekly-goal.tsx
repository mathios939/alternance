import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function WeeklyGoal({ weekly, streak }: { weekly: { done: number; goal: number; percent: number; message: string }; streak: { current: number; longest: number; activeToday: boolean } }) {
  return (
    <section className="surface p-5" aria-labelledby="goal-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="goal-title" className="font-semibold">Objectif de la semaine</h2>
          <p className="text-xs text-muted-foreground">{weekly.message}</p>
        </div>
        <span className="text-2xl font-semibold tabular-nums">
          {weekly.done}
          <span className="text-sm text-muted-foreground"> / {weekly.goal}</span>
        </span>
      </div>
      <Progress value={weekly.percent} className="mt-3" indicatorClassName={weekly.percent >= 100 ? "bg-success" : undefined} aria-label={`${weekly.done} candidatures sur ${weekly.goal}`} />
      <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
        <span className="inline-flex items-center gap-2 text-sm">
          <Flame className={streak.current > 0 ? "size-4 text-warning-foreground dark:text-warning" : "size-4 text-muted-foreground"} aria-hidden />
          <strong className="tabular-nums">{streak.current}</strong> jour{streak.current > 1 ? "s" : ""} actif{streak.current > 1 ? "s" : ""}
          {!streak.activeToday && streak.current > 0 ? <span className="text-xs text-muted-foreground">· agis aujourd'hui pour continuer</span> : null}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Record">
          <Trophy className="size-3.5" aria-hidden /> {streak.longest}
        </span>
      </div>
      <Link href="/settings/profile#goal" className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground">
        Modifier l'objectif
      </Link>
    </section>
  );
}

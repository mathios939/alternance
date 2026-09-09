import { CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import type { ResumeAnalysis } from "@/features/resume/lib/analyze";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/shared/relative-time";

function ScoreRing({ score }: { score: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "stroke-success text-success" : score >= 60 ? "stroke-primary text-primary" : "stroke-warning text-warning-foreground dark:text-warning";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`CV Score : ${score} sur 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className={cn("fill-none transition-[stroke-dashoffset] duration-700", tone.split(" ")[0])} strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className={cn("absolute text-2xl font-semibold tabular-nums", tone.split(" ").slice(1).join(" "))}>
        {score}
        <span className="text-xs font-normal text-muted-foreground"> / 100</span>
      </span>
    </div>
  );
}

export function ResumeScore({ analysis }: { analysis: ResumeAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-5">
        <ScoreRing score={analysis.score} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">CV Score</p>
          <p className="text-lg font-semibold">{analysis.score >= 80 ? "Solide, prêt à envoyer" : analysis.score >= 60 ? "Bon, quelques ajustements" : "À retravailler avant d'envoyer"}</p>
          <p className="text-xs text-muted-foreground">Analyse par règles (lisibilité, structure, mots-clés, compétences, longueur, ATS), mise à jour <RelativeTime date={analysis.analyzedAt} />. {analysis.wordCount} mots.</p>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {analysis.criteria.map((c) => (
          <div key={c.key} className="rounded-lg border bg-card/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums">{c.score}<span className="text-xs text-muted-foreground"> · poids {c.weight}</span></span>
            </div>
            <Progress value={c.score} className="mt-2 h-1.5" indicatorClassName={c.score >= 75 ? "bg-success" : c.score >= 50 ? "bg-primary" : "bg-warning"} />
            <p className="mt-1.5 text-xs text-muted-foreground">{c.comment}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section icon={CheckCircle2} tone="text-success" title="Points forts" items={analysis.strengths} empty="Pas encore de point fort détecté : enrichis le contenu." />
        <Section icon={AlertTriangle} tone="text-warning-foreground dark:text-warning" title="Points faibles" items={analysis.weaknesses} empty="Aucun point faible majeur détecté." />
        <Section icon={Lightbulb} tone="text-primary" title="Améliorations recommandées" items={analysis.improvements} empty="Rien à signaler." />
      </div>
    </div>
  );
}

function Section({ icon: Icon, tone, title, items, empty }: { icon: typeof CheckCircle2; tone: string; title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border bg-card/60 p-4">
      <p className={cn("inline-flex items-center gap-2 text-sm font-semibold", tone)}>
        <Icon className="size-4" aria-hidden /> {title}
      </p>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden /> {i}</li>)}
        </ul>
      )}
    </div>
  );
}

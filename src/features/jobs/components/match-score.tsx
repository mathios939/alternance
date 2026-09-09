"use client";

import { Check, AlertTriangle, Info } from "lucide-react";
import type { MatchResult } from "@/lib/matching";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

const LEVEL_STYLES: Record<MatchResult["level"], { ring: string; text: string; bg: string; label: string }> = {
  excellent: { ring: "stroke-success", text: "text-success", bg: "bg-success-soft", label: "Excellent match" },
  good: { ring: "stroke-primary", text: "text-primary", bg: "bg-primary-soft", label: "Bon match" },
  fair: { ring: "stroke-warning", text: "text-warning-foreground dark:text-warning", bg: "bg-warning-soft", label: "Match partiel" },
  low: { ring: "stroke-muted-foreground", text: "text-muted-foreground", bg: "bg-muted", label: "Peu compatible" },
};

export function MatchScoreRing({ score, level, size = 48, className }: { score: number; level: MatchResult["level"]; size?: number; className?: string }) {
  const stroke = size >= 64 ? 6 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const style = LEVEL_STYLES[level];
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={`Score de compatibilité : ${score} %`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out", style.ring)} strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className={cn("absolute font-semibold tabular-nums", style.text, size >= 64 ? "text-lg" : "text-xs")}>
        {score}
        <span className={size >= 64 ? "text-xs" : "text-[9px]"}> %</span>
      </span>
    </div>
  );
}

export function MatchScoreBadge({ match, className }: { match: MatchResult; className?: string }) {
  const style = LEVEL_STYLES[match.level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums", style.bg, style.text, className)} tabIndex={0}>
          {match.total} % match
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{style.label}</p>
        <ul className="mt-1 space-y-0.5 text-xs opacity-90">
          {match.reasons.slice(0, 4).map((r) => (
            <li key={r.label}>
              {r.kind === "positive" ? "✓" : r.kind === "warning" ? "⚠" : "•"} {r.label}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

const BREAKDOWN_LABELS: Record<keyof MatchResult["breakdown"], string> = {
  education: "Formation",
  skills: "Compétences",
  location: "Localisation",
  experience: "Expérience",
  rhythm: "Rythme & durée",
  mobility: "Mobilité & télétravail",
};

/** Détail complet : pourquoi cette offre te correspond, et les points d'attention. */
export function MatchScoreBreakdown({ match, compact = false }: { match: MatchResult; compact?: boolean }) {
  const style = LEVEL_STYLES[match.level];
  const positives = match.reasons.filter((r) => r.kind === "positive");
  const warnings = match.reasons.filter((r) => r.kind === "warning");
  const neutrals = match.reasons.filter((r) => r.kind === "neutral");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <MatchScoreRing score={match.total} level={match.level} size={72} />
        <div>
          <p className="text-sm text-muted-foreground">Ton score</p>
          <p className={cn("text-xl font-semibold", style.text)}>{style.label}</p>
          <p className="text-xs text-muted-foreground">Calculé à partir de ton profil, selon des règles explicites.</p>
        </div>
      </div>

      {!compact ? (
        <div className="grid gap-2.5">
          {(Object.keys(match.breakdown) as (keyof MatchResult["breakdown"])[]).map((key) => (
            <div key={key} className="grid grid-cols-[120px_1fr_36px] items-center gap-3 text-xs">
              <span className="text-muted-foreground">{BREAKDOWN_LABELS[key]}</span>
              <Progress value={match.breakdown[key]} className="h-1.5" indicatorClassName={match.breakdown[key] >= 70 ? "bg-success" : match.breakdown[key] >= 45 ? "bg-primary" : "bg-warning"} aria-label={`${BREAKDOWN_LABELS[key]} : ${match.breakdown[key]} sur 100 (poids ${match.weights[key]} %)`} />
              <span className="text-right font-medium tabular-nums">{match.breakdown[key]}</span>
            </div>
          ))}
        </div>
      ) : null}

      {positives.length > 0 ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Pourquoi cette offre te correspond</p>
          <ul className="space-y-1.5">
            {positives.map((r) => (
              <li key={r.label} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  {r.label}
                  {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3">
          <p className="mb-1.5 text-sm font-medium">Attention</p>
          <ul className="space-y-1.5">
            {warnings.map((r) => (
              <li key={r.label} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
                <span>
                  {r.label}
                  {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && neutrals.length > 0 ? (
        <ul className="space-y-1">
          {neutrals.map((r) => (
            <li key={r.label} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

import { Gauge } from "lucide-react";
import type { OpportunityResult } from "@/lib/matching";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STYLES: Record<OpportunityResult["level"], { text: string; bg: string; label: string }> = {
  hot: { text: "text-success", bg: "bg-success-soft", label: "Cible prioritaire" },
  warm: { text: "text-primary", bg: "bg-primary-soft", label: "Bonne cible" },
  cool: { text: "text-muted-foreground", bg: "bg-muted", label: "Cible secondaire" },
};

export function OpportunityScoreBadge({ opportunity, className, showLabel = false }: { opportunity: OpportunityResult; className?: string; showLabel?: boolean }) {
  const style = STYLES[opportunity.level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums", style.bg, style.text, className)} tabIndex={0}>
          <Gauge className="size-3.5" aria-hidden />
          {opportunity.score} %{showLabel ? <span className="font-normal opacity-80"> · estimation</span> : null}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{style.label} — potentiel estimé</p>
        <ul className="mt-1 space-y-0.5 text-xs opacity-90">
          {opportunity.reasons.slice(0, 4).map((r) => (
            <li key={r.label}>{r.kind === "positive" ? "✓" : r.kind === "warning" ? "⚠" : "•"} {r.label}</li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] opacity-70">Estimation basée sur des règles explicites, pas une garantie.</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function OpportunityReasons({ opportunity }: { opportunity: OpportunityResult }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {opportunity.reasons.map((r) => (
        <li key={r.label} className="flex items-start gap-2">
          <span className={cn("mt-0.5 text-xs", r.kind === "positive" ? "text-success" : r.kind === "warning" ? "text-warning-foreground dark:text-warning" : "text-muted-foreground")} aria-hidden>
            {r.kind === "positive" ? "✓" : r.kind === "warning" ? "⚠" : "•"}
          </span>
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

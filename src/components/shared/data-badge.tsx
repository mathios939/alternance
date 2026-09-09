import { BadgeCheck, FlaskConical, Gauge, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type DataOriginKind = "REAL" | "DEMO" | "ESTIMATED" | "AI_GENERATED";

const CONFIG: Record<
  DataOriginKind,
  { label: string; help: string; variant: "success" | "warning" | "info" | "soft"; icon: typeof BadgeCheck }
> = {
  REAL: {
    label: "Donnée vérifiée",
    help: "Information provenant d'une source publique vérifiée.",
    variant: "success",
    icon: BadgeCheck,
  },
  DEMO: {
    label: "Démo",
    help: "Donnée de démonstration. Elle ne correspond pas à une offre ou un contact réel.",
    variant: "warning",
    icon: FlaskConical,
  },
  ESTIMATED: {
    label: "Estimation",
    help: "Valeur estimée par nos règles à partir de données publiques. À vérifier.",
    variant: "info",
    icon: Gauge,
  },
  AI_GENERATED: {
    label: "Généré par IA",
    help: "Contenu généré par l'assistant IA. Relis et personnalise avant envoi.",
    variant: "soft",
    icon: Sparkles,
  },
};

export function DataBadge({ kind, className }: { kind: DataOriginKind; className?: string }) {
  const cfg = CONFIG[kind];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={cfg.variant} className={className} tabIndex={0}>
          <Icon aria-hidden /> {cfg.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{cfg.help}</TooltipContent>
    </Tooltip>
  );
}

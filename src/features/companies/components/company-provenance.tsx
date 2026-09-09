import { ExternalLink, Info } from "lucide-react";
import type { DataOrigin } from "@/generated/prisma/enums";
import type { CompanySourceRef } from "@/services/ingestion/data-sources";
import { formatDate } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  "france-travail": "offre officielle France Travail",
  "recherche-entreprises": "Annuaire des entreprises (SIRENE, données publiques)",
  "company-career": "site carrières de l'entreprise",
  manual: "saisie manuelle",
};

/** Provenance d'une entreprise (Phase 13) : sources publiques, SIREN, dernière vérification. */
export function CompanyProvenance({ company }: { company: { isDemo: boolean; dataOrigin: DataOrigin; siren: string | null; nafLabel: string | null; dataSources: CompanySourceRef[]; lastVerifiedAt: string | null } }) {
  if (company.isDemo) return <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5" aria-hidden /> Entreprise fictive de démonstration.</p>;
  const sources = company.dataSources;
  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Info className="size-3.5" aria-hidden /> Source :
        {sources.length === 0 ? (
          <span>provenance non documentée</span>
        ) : (
          sources.map((s, i) => (
            <span key={s.source} className="inline-flex items-center gap-1">
              {i > 0 ? "+ " : ""}
              {s.label ?? SOURCE_LABELS[s.source] ?? s.source}
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" aria-label={`Ouvrir la source ${s.source}`}><ExternalLink className="size-3" aria-hidden /></a> : null}
            </span>
          ))
        )}
        {company.siren ? <span>· SIREN {company.siren}</span> : null}
        {company.nafLabel ? <span>· {company.nafLabel}</span> : null}
      </p>
      <p>{company.lastVerifiedAt ? `Dernière vérification : ${formatDate(company.lastVerifiedAt, "d MMM yyyy 'à' HH:mm")}` : "Aucune vérification datée."} Les champs non fournis par ces sources restent vides : rien n'est deviné.</p>
    </div>
  );
}

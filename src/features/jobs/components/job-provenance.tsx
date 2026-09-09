"use client";

import { AlertTriangle, BadgeCheck, ExternalLink, Info, Mail, ShieldQuestion } from "lucide-react";
import type { JobDetailData } from "@/features/jobs/types";
import { describeVerification } from "@/lib/verification";
import { formatDate } from "@/lib/format";
import { RelativeTime } from "@/components/shared/relative-time";
import { qualityLabel } from "@/services/ingestion/quality";
import { Badge } from "@/components/ui/badge";

/**
 * PROVENANCE (Phase 13) : source, date de vérification, sources multiples, canal de candidature publié,
 * qualité des données. Tout ce qui est affiché vient de la base ; rien n'est déduit ici.
 */
export function JobProvenance({ job }: { job: JobDetailData }) {
  const verification = describeVerification(job.verificationStatus, job.lastVerifiedAt);
  const quality = qualityLabel(job.dataQualityScore);
  const Icon = verification.tone === "success" ? BadgeCheck : verification.tone === "muted" ? ShieldQuestion : AlertTriangle;
  const primary = job.sources.find((s) => s.isPrimary) ?? job.sources[0];
  return (
    <section className="space-y-2 text-sm text-muted-foreground" aria-label="Provenance des données">
      <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Info className="size-3.5" aria-hidden /> Source : <span className="font-medium text-foreground">{job.sourceName}</span>
        {job.sourceUrl ? (
          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            voir l'annonce d'origine <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </p>
      {job.isDemo ? (
        <p className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-warning" aria-hidden /> Offre de démonstration : aucune vérification auprès d'une source réelle.</p>
      ) : (
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon className={`size-3.5 ${verification.tone === "success" ? "text-success" : verification.tone === "muted" ? "text-muted-foreground" : "text-warning"}`} aria-hidden />
          <span className={verification.tone === "destructive" ? "font-medium text-destructive" : undefined}>{verification.label}</span>
          {job.lastVerifiedAt ? <span className="text-xs">({formatDate(job.lastVerifiedAt, "d MMM yyyy 'à' HH:mm")})</span> : null}
          {quality ? <Badge variant={quality === "Données complètes" ? "success" : quality === "Données partielles" ? "warning" : "muted"} className="font-normal">{quality}</Badge> : null}
        </p>
      )}
      {job.sources.length > 1 ? (
        <div>
          <p>Offre trouvée sur {job.sources.length} sources{primary ? ` · candidature via ${primary.name}` : ""} :</p>
          <ul className="mt-1 space-y-0.5">
            {job.sources.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className={s.isPrimary ? "font-medium text-foreground" : undefined}>{s.name}</span>
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ouvrir</a> : null}
                {s.status !== "ACTIVE" ? <span className="text-warning">({s.status === "REMOVED" ? "retirée de cette source" : s.status === "EXPIRED" ? "expirée sur cette source" : "non vérifiée"})</span> : s.lastVerifiedAt ? <span>vérifiée <RelativeTime date={s.lastVerifiedAt} /></span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : job.otherSources.length > 0 ? (
        <p>Également publiée sur : {job.otherSources.map((s) => s.name).join(", ")}.</p>
      ) : null}
      {job.applicationLabel || job.applicationEmail ? (
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <Mail className="size-3.5" aria-hidden /> Canal de candidature publié dans l'offre :
          {job.applicationLabel ? <span className="text-foreground">{job.applicationLabel}</span> : null}
          {job.applicationEmail ? (
            <a href={`mailto:${job.applicationEmail}`} className="text-primary hover:underline">{job.applicationEmail}</a>
          ) : null}
        </p>
      ) : null}
      {job.expiresAt ? <p>Expire le {formatDate(job.expiresAt)}.</p> : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCompare, X } from "lucide-react";
import type { JobCardData } from "@/features/jobs/types";
import { useCompare } from "@/hooks/use-compare";
import { COMPANY_SIZES, REMOTE_POLICIES, SECTORS, WORK_RHYTHMS, educationRangeLabel, type SectorKey } from "@/config/taxonomy";
import { formatDistanceKm, formatPublishedAgo, formatSalary } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchScoreRing } from "@/features/jobs/components/match-score";
import { CompanyLogo } from "@/features/jobs/components/job-card";

export function CompareTable({ initialIds }: { initialIds: string[] }) {
  const compare = useCompare();
  const [state, setState] = useState<{ key: string; items: JobCardData[] } | null>(null);
  const ids = initialIds.length ? initialIds : compare.ids;
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/jobs/compare?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { items: JobCardData[] }) => setState({ key, items: d.items }))
      .catch(() => setState({ key, items: [] }));
    return () => ctrl.abort();
  }, [key]);

  const items = !key ? [] : state?.key === key ? state.items : null;
  if (items === null) return <Skeleton className="h-96 rounded-xl" />;
  if (items.length === 0) return <EmptyState icon={GitCompare} title="Aucune offre à comparer" description="Depuis une offre, clique sur « Comparer » (jusqu'à 4 offres)." action={<Button asChild><Link href="/jobs?sort=match">Voir mes offres</Link></Button>} />;

  const best = (values: Array<number | null>, higher = true) => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    return higher ? Math.max(...nums) : Math.min(...nums);
  };
  const bestMatch = best(items.map((j) => j.match?.total ?? null));
  const bestSalary = best(items.map((j) => j.salaryMax ?? j.salaryMin ?? null));
  const bestDistance = best(items.map((j) => j.distanceKm), false);

  const rows: Array<{ label: string; render: (j: JobCardData) => React.ReactNode }> = [
    { label: "Compatibilité", render: (j) => (j.match ? <span className={cn("font-semibold tabular-nums", j.match.total === bestMatch && "text-success")}>{j.match.total} %</span> : <span className="text-muted-foreground">Crée ton profil</span>) },
    { label: "Salaire", render: (j) => <span className={cn((j.salaryMax ?? j.salaryMin) === bestSalary && "font-semibold text-success")}>{formatSalary(j.salaryMin, j.salaryMax) ?? "Grille légale"}</span> },
    { label: "Distance", render: (j) => (j.distanceKm !== null ? <span className={cn(j.distanceKm === bestDistance && "font-semibold text-success")}>{formatDistanceKm(j.distanceKm)}</span> : <span className="text-muted-foreground">—</span>) },
    { label: "Télétravail", render: (j) => REMOTE_POLICIES[j.remote].label },
    { label: "Taille entreprise", render: (j) => `${COMPANY_SIZES[j.company.size].label} · ${COMPANY_SIZES[j.company.size].range}` },
    { label: "Secteur", render: (j) => SECTORS[j.sector as SectorKey]?.label ?? j.sector },
    { label: "Niveau", render: (j) => educationRangeLabel(j.educationLevelMin, j.educationLevelMax) },
    { label: "Durée", render: (j) => (j.durationMonths ? `${j.durationMonths} mois` : "—") },
    { label: "Rythme", render: (j) => (j.rhythm ? WORK_RHYTHMS[j.rhythm].short : "—") },
    { label: "Publication", render: (j) => formatPublishedAgo(j.publishedAt) },
    {
      label: "Compétences",
      render: (j) => (
        <div className="flex flex-wrap gap-1">
          {j.skills.map((s) => (
            <Badge key={s.slug} variant={j.match?.matchedSkills.includes(s.slug) ? "success" : j.match?.missingSkills.includes(s.slug) ? "warning" : "muted"} className="font-normal">{s.name}</Badge>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-40 p-3 text-left text-xs font-medium text-muted-foreground">Critère</th>
            {items.map((j) => (
              <th key={j.id} className="p-3 text-left align-top">
                <div className="flex items-start gap-2">
                  <CompanyLogo name={j.company.name} logoUrl={j.company.logoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${j.slug}`} className="line-clamp-2 font-semibold hover:underline">{j.title}</Link>
                    <p className="text-xs font-normal text-muted-foreground">{j.company.name} · {j.city}</p>
                  </div>
                  {j.match ? <MatchScoreRing score={j.match.total} level={j.match.level} size={40} /> : null}
                  {!initialIds.length ? <button type="button" onClick={() => compare.toggle(j.id)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Retirer du comparateur"><X className="size-4" /></button> : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b last:border-0">
              <th scope="row" className="p-3 text-left align-top text-xs font-medium text-muted-foreground">{r.label}</th>
              {items.map((j) => <td key={j.id} className="p-3 align-top">{r.render(j)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

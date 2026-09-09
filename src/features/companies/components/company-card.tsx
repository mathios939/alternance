"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Briefcase, MapPin, Users, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceKm } from "@/lib/format";
import { COMPANY_SIZES, SECTORS, type SectorKey } from "@/config/taxonomy";
import type { CompanyCardData } from "@/features/companies/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/features/favorites/server/actions";
import { CompanyLogo } from "@/features/jobs/components/job-card";
import { OpportunityScoreBadge } from "./opportunity-score";

type Props = { company: CompanyCardData & { nearestCity?: string }; variant?: "default" | "compact"; isAuthenticated?: boolean; className?: string };

export function CompanyCard({ company, variant = "default", isAuthenticated = true, className }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isFavorite, setFavorite] = useOptimistic(company.isFavorite);

  function onSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/register?next=${encodeURIComponent(`/companies/${company.slug}`)}`);
      return;
    }
    startTransition(async () => {
      setFavorite(!isFavorite);
      const result = await toggleFavorite({ companyId: company.id, collection: "COMPANIES" });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.data.saved ? "Entreprise ajoutée à tes favoris" : "Retirée des favoris");
      router.refresh();
    });
  }

  const sector = SECTORS[company.sector as SectorKey];
  const compact = variant === "compact";
  return (
    <article className={cn("surface surface-hover relative p-4", className)}>
      <Link href={`/companies/${company.slug}`} className="absolute inset-0 rounded-xl" aria-label={company.name} />
      <div className="pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <div className="flex items-start gap-3">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{company.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {sector ? `${sector.emoji} ${sector.label}` : company.sector} · {COMPANY_SIZES[company.size].label}
            </p>
          </div>
          {company.opportunity ? <OpportunityScoreBadge opportunity={company.opportunity} /> : null}
        </div>
        {!compact && company.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{company.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {company.nearestCity ?? company.city}
            {company.distanceKm !== null ? <span className="text-foreground/70"> · {formatDistanceKm(company.distanceKm)}</span> : null}
          </span>
          {company.headcount ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {company.headcount.toLocaleString("fr-FR")} salariés
            </span>
          ) : null}
          {company.activeJobsCount > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Briefcase className="size-3.5" aria-hidden /> {company.activeJobsCount} offre{company.activeJobsCount > 1 ? "s" : ""}
            </span>
          ) : null}
          {company.hiresApprentices ? (
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3.5" aria-hidden /> Accueille des alternants
            </span>
          ) : null}
        </div>
        {!compact && company.technologies.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {company.technologies.slice(0, 5).map((t) => (
              <Badge key={t} variant="muted" className="font-normal capitalize">
                {t.replace(/-/g, " ")}
              </Badge>
            ))}
          </div>
        ) : null}
        {company.isDemo ? <span className="absolute top-0 right-0 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground dark:text-warning">Démo</span> : null}
        {!compact ? (
          <div className="mt-4 flex items-center gap-2 border-t pt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/companies/${company.slug}`}>Voir l'entreprise</Link>
            </Button>
            <Button variant={isFavorite ? "soft" : "ghost"} size="sm" onClick={onSave} disabled={pending} aria-pressed={isFavorite}>
              {isFavorite ? <BookmarkCheck /> : <Bookmark />} <span className="hidden sm:inline">{isFavorite ? "Suivie" : "Suivre"}</span>
            </Button>
            {company.hasApplication ? <Badge variant="soft" className="ml-auto">Candidature en cours</Badge> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

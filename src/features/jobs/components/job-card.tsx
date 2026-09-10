"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  Send,
  Wifi,
  Check,
  ShieldCheck,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { formatDistanceKm } from "@/lib/format";
import { RelativeTime } from "@/components/shared/relative-time";
import { describeVerification } from "@/lib/verification";
import {
  educationRangeLabel,
  REMOTE_POLICIES,
  APPLICATION_STATUSES,
  CONTRACT_TYPES,
} from "@/config/taxonomy";
import type { JobCardData } from "@/features/jobs/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleFavorite } from "@/features/favorites/server/actions";
import { createApplication } from "@/features/applications/server/actions";
import { useGuestFavorites } from "@/lib/guest/use-guest-favorites";
import { AccountPromptDialog } from "@/features/guest/components/account-prompt";
import { MatchScoreRing } from "./match-score";

type Props = {
  job: JobCardData;
  variant?: "default" | "compact" | "large";
  selected?: boolean;
  onSelect?: (job: JobCardData) => void;
  /** Obligatoire : décide entre favoris du compte et favoris du navigateur, et entre suivi et lien officiel. */
  isAuthenticated: boolean;
  className?: string;
};

export function CompanyLogo({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-[10px]",
    md: "size-11 text-xs",
    lg: "size-16 text-base rounded-2xl",
  };
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "bg-card shrink-0 rounded-xl border object-contain p-1",
          sizes[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "from-muted to-secondary text-muted-foreground flex shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br font-semibold",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Carte d'offre. Sans compte : sauvegarde dans le navigateur et candidature via le lien officiel ;
 * le suivi de candidature (Kanban) est proposé comme avantage du compte, jamais imposé.
 */
export function JobCard({
  job,
  variant = "default",
  selected = false,
  onSelect,
  isAuthenticated,
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({
    isFavorite: job.isFavorite,
    applicationStatus: job.applicationStatus,
  });
  const guest = useGuestFavorites();
  const [prompt, setPrompt] = useState(false);
  const href = `/jobs/${job.slug}`;
  const isFavorite = isAuthenticated ? optimistic.isFavorite : guest.hasJob(job.id);
  const officialUrl = !job.isDemo ? job.applicationUrl : null;

  function onSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      const r = guest.toggleJob(job.id);
      if (r.saved)
        toast.success("Sauvegardée dans ce navigateur", {
          description: "Crée un compte gratuitement pour la retrouver sur tous tes appareils.",
          action: { label: "Mes favoris", onClick: () => router.push("/favorites") },
        });
      else toast.success("Retirée des favoris");
      return;
    }
    startTransition(async () => {
      setOptimistic((s) => ({ ...s, isFavorite: !s.isFavorite }));
      const result = await toggleFavorite({ jobId: job.id });
      if (!result.ok) toast.error(result.error);
      else toast.success(result.data.saved ? "Ajoutée à tes favoris" : "Retirée des favoris");
      router.refresh();
    });
  }

  function onApply(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setPrompt(true);
      return;
    }
    startTransition(async () => {
      setOptimistic((s) => ({ ...s, applicationStatus: "TO_APPLY" }));
      const result = await createApplication({ jobId: job.id, matchScore: job.match?.total });
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          result.data.created
            ? "Ajoutée à tes candidatures (À candidater)"
            : "Déjà dans tes candidatures",
          { action: { label: "Voir", onClick: () => router.push("/applications") } },
        );
      router.refresh();
    });
  }

  const isLarge = variant === "large";
  const isCompact = variant === "compact";
  const status = optimistic.applicationStatus;

  const content = (
    <>
      <div className="flex items-start gap-3">
        <CompanyLogo
          name={job.company.name}
          logoUrl={job.company.logoUrl}
          size={isLarge ? "lg" : "md"}
        />
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "leading-snug font-semibold text-balance",
              isLarge ? "text-lg" : "text-[15px]",
              "line-clamp-2",
            )}
          >
            {job.isNew ? (
              <span
                className="bg-primary/10 text-primary mr-1.5 inline-block translate-y-[-1px] rounded-md px-1.5 py-px align-middle text-[10px] font-semibold tracking-wide uppercase"
                title="Découverte il y a moins de 48 h"
              >
                Nouveau
              </span>
            ) : null}
            {job.title}
          </h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-sm">
            <span className="truncate">{job.company.name}</span>
            {job.isDemo ? (
              <span
                className="bg-warning-soft text-warning-foreground dark:text-warning shrink-0 rounded-md px-1.5 py-px text-[10px] font-medium"
                title="Offre de démonstration (fictive)"
              >
                Démo
              </span>
            ) : null}
          </p>
        </div>
        {job.match ? (
          <MatchScoreRing
            score={job.match.total}
            level={job.match.level}
            size={isLarge ? 64 : 48}
          />
        ) : null}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden /> {job.city}
          {job.distanceKm !== null ? (
            <span className="text-foreground/70"> · {formatDistanceKm(job.distanceKm)}</span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden /> Publié{" "}
          <RelativeTime date={job.publishedAt} mode="published" />
        </span>
        {!job.isDemo ? (
          <span
            className="inline-flex items-center gap-1"
            title={describeVerification(job.verificationStatus, job.lastVerifiedAt).label}
          >
            <ShieldCheck
              className={cn(
                "size-3.5",
                job.verificationStatus === "ACTIVE" ? "text-success" : "text-warning",
              )}
              aria-hidden
            />{" "}
            {job.sourceLabel}
            {job.sourceCount > 1 ? ` (+${job.sourceCount - 1})` : ""}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <GraduationCap className="size-3.5" aria-hidden />{" "}
          {educationRangeLabel(job.educationLevelMin, job.educationLevelMax)}
        </span>
        {job.remote !== "NONE" ? (
          <span className="inline-flex items-center gap-1">
            <Wifi className="size-3.5" aria-hidden /> {REMOTE_POLICIES[job.remote].short}
          </span>
        ) : null}
        {!isCompact ? (
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden /> {CONTRACT_TYPES[job.contractType].short}
          </span>
        ) : null}
      </div>

      {!isCompact && job.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, isLarge ? 8 : 5).map((s) => {
            const matched = job.match?.matchedSkills.includes(s.slug);
            return (
              <Badge key={s.slug} variant={matched ? "success" : "muted"} className="font-normal">
                {matched ? <Check aria-hidden /> : null}
                {s.name}
              </Badge>
            );
          })}
          {job.skills.length > (isLarge ? 8 : 5) ? (
            <Badge variant="outline" className="font-normal">
              +{job.skills.length - (isLarge ? 8 : 5)}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {!isCompact ? (
        <div className="mt-4 flex items-center gap-2 border-t pt-3">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link href={href} onClick={(e) => e.stopPropagation()}>
              Voir l'offre
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isFavorite ? "soft" : "ghost"}
                size="sm"
                onClick={onSave}
                disabled={pending}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? "Retirer des favoris" : "Sauvegarder"}
              >
                {isFavorite ? <BookmarkCheck /> : <Bookmark />}
                <span className="hidden sm:inline">
                  {isFavorite ? "Sauvegardée" : "Sauvegarder"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFavorite
                ? "Retirer des favoris"
                : isAuthenticated
                  ? "Ajouter aux favoris"
                  : "Sauvegarder dans ce navigateur"}
            </TooltipContent>
          </Tooltip>
          {status ? (
            <Badge
              variant={
                APPLICATION_STATUSES[status].tone === "destructive"
                  ? "destructive"
                  : APPLICATION_STATUSES[status].tone === "success"
                    ? "success"
                    : "soft"
              }
              className="ml-auto"
            >
              {APPLICATION_STATUSES[status].label}
            </Badge>
          ) : !isAuthenticated && officialUrl ? (
            <Button asChild size="sm" className="ml-auto">
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Candidater sur le site officiel : ${job.title}`}
              >
                <Send /> Candidater <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : (
            <Button size="sm" className="ml-auto" onClick={onApply} disabled={pending}>
              <Send /> Candidater
            </Button>
          )}
        </div>
      ) : null}
    </>
  );

  const base = cn(
    "surface relative block min-w-0 p-4 text-left transition-all duration-200",
    onSelect ? "w-full cursor-pointer hover:border-foreground/20 hover:shadow-md" : "surface-hover",
    selected && "border-primary ring-2 ring-primary/20 shadow-md",
    isLarge && "p-5",
    className,
  );

  const dialog = !isAuthenticated ? (
    <AccountPromptDialog
      open={prompt}
      onOpenChange={setPrompt}
      title="Crée un compte gratuitement pour sauvegarder et suivre cette candidature."
      description={
        officialUrl
          ? "Tu peux aussi candidater directement sur le site officiel, sans compte."
          : "Cette offre n'indique pas de lien de candidature : ouvre la fiche pour voir le canal publié par la source."
      }
      next={href}
    />
  ) : null;

  if (onSelect) {
    return (
      <>
        <article
          className={base}
          onClick={() => onSelect(job)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(job);
            }
          }}
          tabIndex={0}
          role="button"
          aria-pressed={selected}
          aria-label={`${job.title} chez ${job.company.name}`}
        >
          {content}
        </article>
        {dialog}
      </>
    );
  }
  return (
    <>
      <article className={base}>
        <Link
          href={href}
          className="absolute inset-0 rounded-xl"
          aria-label={`${job.title} chez ${job.company.name}`}
        />
        <div className="pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          {content}
        </div>
      </article>
      {dialog}
    </>
  );
}

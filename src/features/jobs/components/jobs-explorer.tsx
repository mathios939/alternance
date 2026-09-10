"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import type { JobCardData, JobDetailData, JobSearchResult } from "@/features/jobs/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonText } from "@/components/shared/skeleton-card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "./job-card";
import { JobDetails } from "./job-details";
import { MobileFiltersSheet, SearchFiltersPanel, useJobFilters } from "./search-filters";
import { SearchBar } from "./search-bar";
import { PersonalizeResults } from "@/features/guest/components/personalize-results";
import { useGuestProfile } from "@/lib/guest/use-guest-profile";
import { SyncStatus } from "./sync-status";

type Props = {
  result: JobSearchResult;
  isAuthenticated: boolean;
  hasProfile: boolean;
  activeFilters: number;
  initialQuery: string;
  initialCity: string;
  initialRadius?: number;
};

type DetailState = { key: string; data: JobDetailData | null; error: string | null };

/** Cache mémoire des fiches consultées (borné), partagé entre navigations. Clé : slug + version du profil visiteur. */
const detailCache = new Map<string, JobDetailData>();
function remember(cacheKey: string, job: JobDetailData) {
  if (detailCache.size >= 200) detailCache.delete(detailCache.keys().next().value as string);
  detailCache.set(cacheKey, job);
}

/**
 * Détail d'une offre. `version` change quand le profil visiteur est modifié : la fiche est alors
 * rechargée pour afficher le nouveau score (sans compte, le score dépend du cookie de préférences).
 */
function useJobDetail(slug: string | null, version: string) {
  const cacheKey = slug ? `${slug}|${version}` : null;
  const [state, setState] = useState<DetailState | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = cacheKey ? `${cacheKey}:${nonce}` : "";
  const cached = cacheKey ? (detailCache.get(cacheKey) ?? null) : null;

  useEffect(() => {
    if (!slug || !cacheKey || detailCache.has(cacheKey)) return;
    const ctrl = new AbortController();
    fetch(`/api/jobs/${slug}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 404 ? "Cette offre n'existe plus." : "Impossible de charger l'offre.",
          );
        return (await r.json()) as JobDetailData;
      })
      .then((j) => {
        remember(cacheKey, j);
        setState({ key, data: j, error: null });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ key, data: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [slug, cacheKey, key]);

  const data = cached ?? (state?.key === key ? state.data : null);
  const error = !cached && state?.key === key ? state.error : null;
  const loading = Boolean(slug) && !data && !error;
  return {
    data,
    loading,
    error,
    retry: () => {
      if (cacheKey) detailCache.delete(cacheKey);
      setNonce((n) => n + 1);
    },
  };
}

const desktopQuery = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(desktopQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function JobsExplorer({
  result,
  isAuthenticated,
  hasProfile,
  activeFilters,
  initialQuery,
  initialCity,
  initialRadius,
}: Props) {
  const { filters, setFilters, pending } = useJobFilters();
  const [selectedSlug, setSelectedSlug] = useQueryState("job", parseAsString);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true,
  );
  const effectiveSlug = selectedSlug ?? (isDesktop ? (result.items[0]?.slug ?? null) : null);
  const { profile: guestProfile } = useGuestProfile();
  const detail = useJobDetail(
    effectiveSlug,
    isAuthenticated ? "" : (guestProfile?.updatedAt ?? ""),
  );

  function select(job: JobCardData) {
    void setSelectedSlug(job.slug);
    if (!isDesktop) setMobileOpen(true);
  }

  const showingFrom = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const showingTo = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 max-w-3xl">
        <SearchBar
          size="md"
          initialQuery={initialQuery}
          initialCity={initialCity}
          initialRadius={initialRadius}
        />
        {result.interpretation?.length ? (
          <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs">
            <Sparkles className="text-primary size-3.5" aria-hidden /> Compris :{" "}
            {result.interpretation.join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(380px,1fr)_minmax(420px,1.2fr)]">
        <aside className="hidden lg:block" aria-label="Filtres">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] scrollbar-thin overflow-y-auto pr-1">
            <SearchFiltersPanel hasProfile={hasProfile} />
          </div>
        </aside>

        <section aria-label="Résultats" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {pending ? (
                  <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden />
                ) : null}
                {result.total === 0
                  ? "Aucune offre"
                  : `${showingFrom}–${showingTo} sur ${result.total} offre${result.total > 1 ? "s" : ""}`}
              </p>
              {result.freshness ? <SyncStatus freshness={result.freshness} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isAuthenticated ? (
                <PersonalizeResults
                  hasProfile={hasProfile}
                  initialCity={initialCity}
                  initialQuery={initialQuery}
                  initialRadius={initialRadius}
                />
              ) : null}
              <MobileFiltersSheet hasProfile={hasProfile} activeCount={activeFilters} />
              <Select
                value={filters.sort}
                onValueChange={(v) => setFilters({ sort: v as typeof filters.sort, page: null })}
              >
                <SelectTrigger size="sm" className="w-[170px]" aria-label="Trier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Pertinence</SelectItem>
                  <SelectItem value="recent">Plus récentes</SelectItem>
                  {hasProfile ? <SelectItem value="match">Meilleur match</SelectItem> : null}
                  {hasProfile || filters.city ? (
                    <SelectItem value="distance">Distance</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucune offre ne correspond"
              description="Essaie d'élargir le rayon, de retirer un filtre ou de reformuler ta recherche."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      city: null,
                      region: null,
                      radius: null,
                      remote: null,
                      levels: null,
                      contracts: null,
                      durations: null,
                      published: null,
                      sectors: null,
                      families: null,
                      minMatch: null,
                      page: null,
                    })
                  }
                >
                  Retirer les filtres
                </Button>
              }
            />
          ) : (
            <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
              {result.items.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSelect={select}
                  selected={job.slug === effectiveSlug}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          )}

          {result.totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={result.page <= 1 || pending}
                onClick={() => setFilters({ page: result.page - 1 })}
              >
                <ChevronLeft /> Précédent
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {result.page} / {result.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={result.page >= result.totalPages || pending}
                onClick={() => setFilters({ page: result.page + 1 })}
              >
                Suivant <ChevronRight />
              </Button>
            </nav>
          ) : null}
        </section>

        <aside className="hidden xl:block" aria-label="Détail de l'offre">
          <div className="surface sticky top-24 max-h-[calc(100vh-7rem)] scrollbar-thin overflow-y-auto p-5">
            {!effectiveSlug ? (
              <EmptyState
                compact
                title="Sélectionne une offre"
                description="Le détail s'affiche ici, sans recharger la page."
              />
            ) : detail.error ? (
              <ErrorState
                title="Offre indisponible"
                description={detail.error}
                onRetry={detail.retry}
              />
            ) : detail.loading || !detail.data ? (
              <DetailSkeleton />
            ) : (
              <>
                <JobDetails
                  job={detail.data}
                  isAuthenticated={isAuthenticated}
                  hasProfile={hasProfile}
                />
                <div className="mt-6 border-t pt-4">
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/jobs/${detail.data.slug}`}>
                      Ouvrir en pleine page <ArrowRight />
                    </a>
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <Sheet
        open={mobileOpen && !isDesktop}
        onOpenChange={(o) => {
          setMobileOpen(o);
          if (!o) void setSelectedSlug(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full max-w-none overflow-y-auto sm:max-w-xl"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Détail de l'offre</SheetTitle>
          <div className="p-4 pt-12 sm:p-5">
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 -ml-2"
              onClick={() => setMobileOpen(false)}
            >
              <ArrowLeft /> Retour aux résultats
            </Button>
            {detail.error ? (
              <ErrorState description={detail.error} onRetry={detail.retry} />
            ) : detail.loading || !detail.data ? (
              <DetailSkeleton />
            ) : (
              <JobDetails
                job={detail.data}
                isAuthenticated={isAuthenticated}
                hasProfile={hasProfile}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <div className="flex gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <SkeletonText lines={6} />
    </div>
  );
}

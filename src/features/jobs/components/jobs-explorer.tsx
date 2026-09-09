"use client";

import { useEffect, useRef, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2, Search, Sparkles } from "lucide-react";
import type { JobCardData, JobDetailData, JobSearchResult } from "@/features/jobs/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonText } from "@/components/shared/skeleton-card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "./job-card";
import { JobDetails } from "./job-details";
import { MobileFiltersSheet, SearchFiltersPanel, useJobFilters } from "./search-filters";
import { SearchBar } from "./search-bar";

type Props = { result: JobSearchResult; isAuthenticated: boolean; hasProfile: boolean; activeFilters: number; initialQuery: string; initialCity: string };

function useJobDetail(slug: string | null) {
  const [data, setData] = useState<JobDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cache = useRef(new Map<string, JobDetailData>());
  useEffect(() => {
    if (!slug) {
      setData(null);
      return;
    }
    const cached = cache.current.get(slug);
    if (cached) {
      setData(cached);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/jobs/${slug}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Cette offre n'existe plus." : "Impossible de charger l'offre.");
        return (await r.json()) as JobDetailData;
      })
      .then((j) => {
        cache.current.set(slug, j);
        setData(j);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [slug, nonce]);
  return { data, loading, error, retry: () => { cache.current.delete(slug ?? ""); setNonce((n) => n + 1); } };
}

export function JobsExplorer({ result, isAuthenticated, hasProfile, activeFilters, initialQuery, initialCity }: Props) {
  const { filters, setFilters, pending } = useJobFilters();
  const [selectedSlug, setSelectedSlug] = useQueryState("job", parseAsString);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const effectiveSlug = selectedSlug ?? (isDesktop ? (result.items[0]?.slug ?? null) : null);
  const detail = useJobDetail(effectiveSlug);

  function select(job: JobCardData) {
    void setSelectedSlug(job.slug);
    if (!isDesktop) setMobileOpen(true);
  }

  const showingFrom = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const showingTo = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 max-w-3xl">
        <SearchBar size="md" initialQuery={initialQuery} initialCity={initialCity} />
        {result.interpretation?.length ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden /> Compris : {result.interpretation.join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(380px,1fr)_minmax(420px,1.2fr)]">
        <aside className="hidden lg:block" aria-label="Filtres">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 scrollbar-thin">
            <SearchFiltersPanel hasProfile={hasProfile} />
          </div>
        </aside>

        <section aria-label="Résultats" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pending ? <Loader2 className="mr-1 inline size-3.5 animate-spin" aria-hidden /> : null}
              {result.total === 0 ? "Aucune offre" : `${showingFrom}–${showingTo} sur ${result.total} offre${result.total > 1 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-2">
              <MobileFiltersSheet hasProfile={hasProfile} activeCount={activeFilters} />
              <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as typeof filters.sort, page: null })}>
                <SelectTrigger size="sm" className="w-[170px]" aria-label="Trier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Pertinence</SelectItem>
                  <SelectItem value="recent">Plus récentes</SelectItem>
                  {hasProfile ? <SelectItem value="match">Meilleur match</SelectItem> : null}
                  {hasProfile || filters.city ? <SelectItem value="distance">Distance</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {result.items.length === 0 ? (
            <EmptyState icon={Search} title="Aucune offre ne correspond" description="Essaie d'élargir le rayon, de retirer un filtre ou de reformuler ta recherche." action={<Button variant="outline" onClick={() => setFilters({ city: null, region: null, radius: null, remote: null, levels: null, contracts: null, durations: null, published: null, sectors: null, families: null, minMatch: null, page: null })}>Retirer les filtres</Button>} />
          ) : (
            <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
              {result.items.map((job) => (
                <JobCard key={job.id} job={job} onSelect={select} selected={job.slug === effectiveSlug} isAuthenticated={isAuthenticated} />
              ))}
            </div>
          )}

          {result.totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <Button variant="outline" size="sm" disabled={result.page <= 1 || pending} onClick={() => setFilters({ page: result.page - 1 })}>
                <ChevronLeft /> Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {result.page} / {result.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={result.page >= result.totalPages || pending} onClick={() => setFilters({ page: result.page + 1 })}>
                Suivant <ChevronRight />
              </Button>
            </nav>
          ) : null}
        </section>

        <aside className="hidden xl:block" aria-label="Détail de l'offre">
          <div className="surface sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5 scrollbar-thin">
            {!effectiveSlug ? (
              <EmptyState compact title="Sélectionne une offre" description="Le détail s'affiche ici, sans recharger la page." />
            ) : detail.error ? (
              <ErrorState title="Offre indisponible" description={detail.error} onRetry={detail.retry} />
            ) : detail.loading || !detail.data ? (
              <DetailSkeleton />
            ) : (
              <>
                <JobDetails job={detail.data} isAuthenticated={isAuthenticated} />
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

      <Sheet open={mobileOpen && !isDesktop} onOpenChange={(o) => { setMobileOpen(o); if (!o) void setSelectedSlug(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetTitle className="sr-only">Détail de l'offre</SheetTitle>
          <div className="p-5 pt-12">
            <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => setMobileOpen(false)}>
              <ArrowLeft /> Retour aux résultats
            </Button>
            {detail.error ? <ErrorState description={detail.error} onRetry={detail.retry} /> : detail.loading || !detail.data ? <DetailSkeleton /> : <JobDetails job={detail.data} isAuthenticated={isAuthenticated} />}
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

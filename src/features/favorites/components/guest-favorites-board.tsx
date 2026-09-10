"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Lock, UserRound } from "lucide-react";
import type { JobCardData } from "@/features/jobs/types";
import type { CompanyCardData } from "@/features/companies/types";
import { useGuestFavorites } from "@/lib/guest/use-guest-favorites";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { JobCard } from "@/features/jobs/components/job-card";
import { CompanyCard } from "@/features/companies/components/company-card";

type Loaded = { key: string; jobs: JobCardData[]; companies: CompanyCardData[] };

/** Favoris d'un visiteur : identifiants dans le navigateur, cartes chargées depuis l'API (sans compte). */
export function GuestFavoritesBoard() {
  const guest = useGuestFavorites();
  const key = `${guest.jobs.join(",")}|${guest.companies.join(",")}`;
  const [state, setState] = useState<Loaded | null>(null);

  useEffect(() => {
    if (guest.jobs.length === 0 && guest.companies.length === 0) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (guest.jobs.length) params.set("jobs", guest.jobs.join(","));
    if (guest.companies.length) params.set("companies", guest.companies.join(","));
    fetch(`/api/favorites/local?${params}`, { signal: ctrl.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as { jobs: JobCardData[]; companies: CompanyCardData[] }) : { jobs: [], companies: [] }))
      .then((d) => setState({ key, jobs: d.jobs, companies: d.companies }))
      .catch(() => setState({ key, jobs: [], companies: [] }));
    return () => ctrl.abort();
  }, [key, guest.jobs, guest.companies]);

  if (guest.count === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="Aucun favori dans ce navigateur"
        description="Sauvegarde des offres et des entreprises depuis la recherche : elles apparaîtront ici, sans compte."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild><Link href="/jobs">Chercher des offres</Link></Button>
            <Button asChild variant="outline"><Link href="/register?next=/favorites"><UserRound /> Créer un compte</Link></Button>
          </div>
        }
      />
    );
  }

  const loaded = state?.key === key ? state : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4 text-sm">
        <Lock className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-medium">Sauvegardés dans ce navigateur uniquement.</span> Crée un compte gratuitement pour retrouver tes favoris sur tous tes appareils : ils seront importés automatiquement.
        </p>
        <Button asChild size="sm">
          <Link href="/register?next=/favorites">Créer un compte gratuitement</Link>
        </Button>
      </div>
      {!loaded ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: Math.min(4, guest.count) }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {loaded.jobs.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Offres ({loaded.jobs.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {loaded.jobs.map((job) => (
                  <JobCard key={job.id} job={job} isAuthenticated={false} />
                ))}
              </div>
            </section>
          ) : null}
          {loaded.companies.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Entreprises suivies ({loaded.companies.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {loaded.companies.map((c) => (
                  <CompanyCard key={c.id} company={c} isAuthenticated={false} />
                ))}
              </div>
            </section>
          ) : null}
          {loaded.jobs.length === 0 && loaded.companies.length === 0 ? <EmptyState compact icon={Bookmark} title="Ces favoris ne sont plus disponibles" description="Les offres sauvegardées ont expiré ou ont été retirées." action={<Button variant="outline" onClick={guest.clear}>Vider la liste</Button>} /> : null}
        </>
      )}
    </div>
  );
}

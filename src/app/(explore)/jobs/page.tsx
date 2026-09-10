import type { Metadata } from "next";
import { after } from "next/server";
import { getVisitorContext } from "@/features/profile/server/visitor";
import {
  getSearchFreshness,
  liveSearchTarget,
  runLiveRefresh,
  shouldRefreshLive,
} from "@/services/ingestion/live-refresh";
import { createLogger } from "@/lib/logger";
import { searchJobs } from "@/features/jobs/server/queries";
import { countActiveFilters, jobFiltersSchema } from "@/features/jobs/lib/filters";
import { parseNaturalQuery } from "@/features/jobs/lib/query-parser";
import { JobsExplorer } from "@/features/jobs/components/jobs-explorer";

/** Le rafraîchissement live (après la réponse) peut durer quelques secondes de plus que la page elle-même. */
export const maxDuration = 60;

const log = createLogger("jobs:page");

export const metadata: Metadata = {
  title: "Offres d'alternance",
  description:
    "Toutes les offres d'alternance en France, dédoublonnées, filtrables par ville, rayon, niveau, rythme et télétravail, avec score de compatibilité. Recherche sans compte.",
};

/** Recherche d'offres : accessible sans compte. Les scores utilisent le profil du compte ou le profil visiteur. */
export default async function JobsPage(props: PageProps<"/jobs">) {
  const params = await props.searchParams;
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
  );
  let filters = jobFiltersSchema.parse(flat);
  let interpretation: string[] | undefined;

  // Requête en langage naturel : « cybersécurité à Rennes Bac+3 dans un rayon de 30 km »
  if (filters.q && !filters.city && !filters.levels.length && !filters.radius) {
    const parsed = parseNaturalQuery(filters.q);
    if (
      parsed.city ||
      parsed.region ||
      parsed.levels ||
      parsed.radius ||
      parsed.remote ||
      parsed.durations
    ) {
      filters = jobFiltersSchema.parse({
        ...flat,
        q: parsed.q ?? "",
        city: parsed.city ?? flat["city"] ?? "",
        region: parsed.region ?? flat["region"] ?? "",
        radius: parsed.radius ?? flat["radius"],
        levels: parsed.levels?.join(",") ?? flat["levels"],
        remote: parsed.remote?.join(",") ?? flat["remote"],
        durations: parsed.durations?.join(",") ?? flat["durations"],
        published: parsed.published ?? flat["published"],
      });
      interpretation = parsed.interpretation;
    }
  }

  const visitor = await getVisitorContext();
  const [result, freshness] = await Promise.all([
    searchJobs(filters, { userId: visitor.userId, candidate: visitor.candidate }),
    getSearchFreshness(filters).catch(() => null),
  ]);

  // Recherche live : la réponse part tout de suite depuis la base ; la zone est rafraîchie auprès de la
  // source APRÈS la réponse (`after`), seulement si sa dernière actualisation est ancienne et si le quota le permet.
  const target = liveSearchTarget(filters);
  let refreshing = freshness?.refreshing ?? false;
  if (target) {
    const check = await shouldRefreshLive(target).catch(() => null);
    if (check?.due) {
      refreshing = true;
      after(async () => {
        try {
          await runLiveRefresh(target);
        } catch (error) {
          log.warn("Rafraîchissement live impossible", { key: target.key, error: String(error) });
        }
      });
    }
  }

  return (
    <JobsExplorer
      result={{
        ...result,
        interpretation,
        freshness: freshness ? { ...freshness, refreshing } : undefined,
      }}
      isAuthenticated={visitor.isAuthenticated}
      hasProfile={visitor.hasProfile}
      activeFilters={countActiveFilters(filters)}
      initialQuery={filters.q}
      initialCity={filters.city}
      initialRadius={filters.radius}
    />
  );
}

import type { Metadata } from "next";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { searchJobs } from "@/features/jobs/server/queries";
import { countActiveFilters, jobFiltersSchema } from "@/features/jobs/lib/filters";
import { parseNaturalQuery } from "@/features/jobs/lib/query-parser";
import { JobsExplorer } from "@/features/jobs/components/jobs-explorer";

export const metadata: Metadata = {
  title: "Offres d'alternance",
  description: "Toutes les offres d'alternance en France, dédoublonnées, filtrables par ville, rayon, niveau, rythme et télétravail, avec score de compatibilité. Recherche sans compte.",
};

/** Recherche d'offres : accessible sans compte. Les scores utilisent le profil du compte ou le profil visiteur. */
export default async function JobsPage(props: PageProps<"/jobs">) {
  const params = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]));
  let filters = jobFiltersSchema.parse(flat);
  let interpretation: string[] | undefined;

  // Requête en langage naturel : « cybersécurité à Rennes Bac+3 dans un rayon de 30 km »
  if (filters.q && !filters.city && !filters.levels.length && !filters.radius) {
    const parsed = parseNaturalQuery(filters.q);
    if (parsed.city || parsed.region || parsed.levels || parsed.radius || parsed.remote || parsed.durations) {
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
  const result = await searchJobs(filters, { userId: visitor.userId, candidate: visitor.candidate });

  return (
    <JobsExplorer
      result={{ ...result, interpretation }}
      isAuthenticated={visitor.isAuthenticated}
      hasProfile={visitor.hasProfile}
      activeFilters={countActiveFilters(filters)}
      initialQuery={filters.q}
      initialCity={filters.city}
      initialRadius={filters.radius}
    />
  );
}

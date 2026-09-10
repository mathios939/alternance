import type { Metadata } from "next";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { CompareTable } from "@/features/compare/components/compare-table";
import { PersonalizeResults } from "@/features/guest/components/personalize-results";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Comparer des offres" };

/** Comparateur : liste conservée dans le navigateur, accessible sans compte. */
export default async function ComparePage(props: PageProps<"/compare">) {
  const [visitor, params] = await Promise.all([getVisitorContext(), props.searchParams]);
  const ids = typeof params["ids"] === "string" ? params["ids"].split(",").filter(Boolean).slice(0, 4) : [];
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader
        title="Comparateur"
        description="Jusqu'à 4 offres côte à côte : compatibilité, salaire, distance, télétravail, entreprise, compétences. En vert : le meilleur sur le critère."
        actions={!visitor.isAuthenticated ? <PersonalizeResults hasProfile={visitor.hasProfile} size="default" /> : null}
      />
      <CompareTable initialIds={ids} />
    </PageContainer>
  );
}

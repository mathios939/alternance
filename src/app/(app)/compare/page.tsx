import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { CompareTable } from "@/features/compare/components/compare-table";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Comparer des offres" };

export default async function ComparePage(props: PageProps<"/compare">) {
  await requireUser();
  const params = await props.searchParams;
  const ids = typeof params["ids"] === "string" ? params["ids"].split(",").filter(Boolean).slice(0, 4) : [];
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader title="Comparateur" description="Jusqu'à 4 offres côte à côte : compatibilité, salaire, distance, télétravail, entreprise, compétences. En vert : le meilleur sur le critère." />
      <CompareTable initialIds={ids} />
    </PageContainer>
  );
}

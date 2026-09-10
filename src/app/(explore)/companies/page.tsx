import type { Metadata } from "next";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { companyFiltersSchema, searchCompanies } from "@/features/companies/server/queries";
import { CompanyFilters } from "@/features/companies/components/company-filters";
import { CompanyCard } from "@/features/companies/components/company-card";
import { PersonalizeResults } from "@/features/guest/components/personalize-results";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Entreprises", description: "Trouve les entreprises qui accueillent des alternants près de chez toi, avec ou sans offre publiée. Sans compte." };

/** Annuaire d'entreprises : accessible sans compte ; le potentiel estimé utilise le profil du compte ou le profil visiteur. */
export default async function CompaniesPage(props: PageProps<"/companies">) {
  const params = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]));
  const filters = companyFiltersSchema.parse(flat);
  const visitor = await getVisitorContext();
  const result = await searchCompanies(filters, { userId: visitor.userId, candidate: visitor.candidate });
  const qs = (page: number) => {
    const p = new URLSearchParams(flat as Record<string, string>);
    p.set("page", String(page));
    return `/companies?${p}`;
  };
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Trouve une entreprise à contacter"
        description="Toutes les entreprises référencées, avec leur potentiel estimé pour ton profil. Beaucoup recrutent des alternants sans publier d'annonce."
        actions={
          <div className="flex flex-wrap gap-2">
            {!visitor.isAuthenticated ? <PersonalizeResults hasProfile={visitor.hasProfile} initialCity={filters.city} size="default" /> : null}
            <Button asChild variant="outline"><Link href="/radar">Ouvrir le Radar</Link></Button>
          </div>
        }
      />
      <CompanyFilters hasProfile={visitor.hasProfile} total={result.total} />
      {result.items.length === 0 ? (
        <EmptyState icon={Building2} title="Aucune entreprise ne correspond" description="Élargis le rayon ou retire un filtre." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((c) => (
            <CompanyCard key={c.id} company={c} isAuthenticated={visitor.isAuthenticated} />
          ))}
        </div>
      )}
      {result.totalPages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" disabled={result.page <= 1}>
            <Link href={qs(result.page - 1)} aria-disabled={result.page <= 1}>
              <ChevronLeft /> Précédent
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {result.page} / {result.totalPages}</span>
          <Button asChild variant="outline" size="sm">
            <Link href={qs(result.page + 1)} aria-disabled={result.page >= result.totalPages}>
              Suivant <ChevronRight />
            </Link>
          </Button>
        </nav>
      ) : null}
    </PageContainer>
  );
}

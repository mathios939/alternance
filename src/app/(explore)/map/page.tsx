import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getVisitorContext } from "@/features/profile/server/visitor";
import { PersonalizeResults } from "@/features/guest/components/personalize-results";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Carte", description: "Offres et entreprises d'alternance sur une carte, sans compte." };

const OpportunityMap = dynamic(() => import("@/features/map/components/opportunity-map").then((m) => m.OpportunityMap), { loading: () => <Skeleton className="h-[640px] rounded-xl" /> });

/** Carte : accessible sans compte, centrée sur la ville du profil (compte ou visiteur), sinon sur Nantes. */
export default async function MapPage() {
  const visitor = await getVisitorContext();
  const c = visitor.candidate;
  const center = c && c.latitude !== null && c.longitude !== null ? { lat: c.latitude, lng: c.longitude } : { lat: 47.2184, lng: -1.5536 };
  const mapStyleUrl = process.env["NEXT_PUBLIC_MAP_STYLE_URL"] || null;
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader
        title="Carte des opportunités"
        description="Offres et entreprises autour de toi, regroupées par zone. Clique sur un point pour ouvrir la fiche."
        actions={!visitor.isAuthenticated ? <PersonalizeResults hasProfile={visitor.hasProfile} size="default" /> : null}
      />
      <OpportunityMap center={center} zoom={c?.city ? 10 : 6} mapStyleUrl={mapStyleUrl} hasProfile={visitor.hasProfile} />
    </PageContainer>
  );
}

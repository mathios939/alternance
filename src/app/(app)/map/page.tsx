import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requireUser } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Carte" };

const OpportunityMap = dynamic(() => import("@/features/map/components/opportunity-map").then((m) => m.OpportunityMap), { loading: () => <Skeleton className="h-[640px] rounded-xl" /> });

export default async function MapPage() {
  const user = await requireUser();
  const ctx = await getCandidateContext(user.id);
  const center = ctx?.profile.latitude !== null && ctx?.profile.latitude !== undefined && ctx.profile.longitude !== null ? { lat: ctx.profile.latitude, lng: ctx.profile.longitude } : { lat: 47.2184, lng: -1.5536 };
  const mapStyleUrl = process.env["NEXT_PUBLIC_MAP_STYLE_URL"] || null;
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader title="Carte des opportunités" description="Offres et entreprises autour de toi, regroupées par zone. Clique sur un point pour ouvrir la fiche." />
      <OpportunityMap center={center} zoom={ctx?.profile.city ? 10 : 6} mapStyleUrl={mapStyleUrl} hasProfile={Boolean(ctx)} />
    </PageContainer>
  );
}

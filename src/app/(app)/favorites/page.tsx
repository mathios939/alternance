import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getFavorites } from "@/features/favorites/server/queries";
import { FavoritesBoard } from "@/features/favorites/components/favorites-board";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Favoris" };

export default async function FavoritesPage() {
  const user = await requireUser();
  const ctx = await getCandidateContext(user.id);
  const entries = await getFavorites(user.id, ctx?.candidate ?? null);
  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Favoris" description={`${entries.length} élément${entries.length > 1 ? "s" : ""} sauvegardé${entries.length > 1 ? "s" : ""}, organisés en collections.`} />
      <FavoritesBoard entries={entries} />
    </PageContainer>
  );
}

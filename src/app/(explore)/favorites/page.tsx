import type { Metadata } from "next";
import { getSession, requireUser } from "@/lib/auth/session";
import { getCandidateContext } from "@/features/profile/server/queries";
import { getFavorites } from "@/features/favorites/server/queries";
import { FavoritesBoard } from "@/features/favorites/components/favorites-board";
import { GuestFavoritesBoard } from "@/features/favorites/components/guest-favorites-board";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Favoris", robots: { index: false } };

/** Favoris : collections du compte, ou favoris conservés dans ce navigateur pour un visiteur. */
export default async function FavoritesPage() {
  const session = await getSession();
  if (!session) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Favoris" description="Les offres et entreprises que tu as sauvegardées dans ce navigateur." />
        <GuestFavoritesBoard />
      </PageContainer>
    );
  }
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

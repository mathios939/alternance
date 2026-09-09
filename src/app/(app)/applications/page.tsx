import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquare, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getApplicationsBoard } from "@/features/applications/server/queries";
import { ApplicationKanban } from "@/features/applications/components/application-kanban";
import { FollowUpsPanel } from "@/features/applications/components/follow-ups-panel";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Candidatures" };

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const board = await getApplicationsBoard(user.id);
  const sent = board.columns.SENT.length + board.columns.TO_FOLLOW_UP.length + board.columns.INTERVIEW.length + board.columns.OFFER.length + board.columns.REJECTED.length + board.columns.ACCEPTED.length;
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader
        title="Candidatures"
        description={`${board.total} candidature${board.total > 1 ? "s" : ""} suivie${board.total > 1 ? "s" : ""} · ${sent} envoyée${sent > 1 ? "s" : ""}. Glisse les cartes pour changer de statut.`}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/outreach">Outreach CRM</Link></Button>
            <Button asChild><Link href="/jobs?sort=match"><Plus /> Trouver une offre</Link></Button>
          </>
        }
      />
      <FollowUpsPanel followUps={board.followUps} highlight={params["filter"] === "followups"} />
      {board.total === 0 ? (
        <EmptyState icon={KanbanSquare} title="Aucune candidature pour le moment" description="Depuis une offre, clique sur « Candidater » pour l'ajouter ici. Depuis une entreprise, prépare une candidature spontanée." action={<Button asChild><Link href="/jobs?sort=match">Voir mes meilleures offres</Link></Button>} />
      ) : (
        <ApplicationKanban board={board} />
      )}
    </PageContainer>
  );
}

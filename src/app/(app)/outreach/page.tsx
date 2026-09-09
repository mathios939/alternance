import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getOutreaches } from "@/features/outreach/server/queries";
import { OutreachTable } from "@/features/outreach/components/outreach-table";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Outreach" };

export default async function OutreachPage() {
  const user = await requireUser();
  const rows = await getOutreaches(user.id);
  const due = rows.filter((r) => r.nextFollowUpAt && new Date(r.nextFollowUpAt) < new Date() && r.status !== "CLOSED" && r.status !== "REPLIED").length;
  return (
    <PageContainer wide className="space-y-6">
      <PageHeader title="Outreach" description={`Ton CRM personnel : ${rows.length} prise${rows.length > 1 ? "s" : ""} de contact${due ? ` · ${due} relance${due > 1 ? "s" : ""} en retard` : ""}.`} />
      <OutreachTable rows={rows} />
    </PageContainer>
  );
}

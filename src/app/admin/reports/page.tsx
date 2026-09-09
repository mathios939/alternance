import Link from "next/link";
import { listReportsAdmin } from "@/features/admin/server/queries";
import { ReportActions } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelative } from "@/lib/format";

const REASON: Record<string, string> = { JOB_EXPIRED: "Offre expirée", FAKE_JOB: "Fausse offre", INCORRECT_INFO: "Information incorrecte", INCORRECT_CONTACT: "Contact incorrect", INCORRECT_COMPANY: "Entreprise incorrecte" };

export default async function AdminReportsPage() {
  const reports = await listReportsAdmin();
  if (reports.length === 0) return <EmptyState title="Aucun signalement" description="Les signalements des utilisateurs apparaîtront ici." />;
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Motif</TableHead><TableHead>Cible</TableHead><TableHead>Détails</TableHead><TableHead>Par</TableHead><TableHead>Date</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{REASON[r.reason] ?? r.reason}</TableCell>
              <TableCell>{r.job ? <Link href={`/jobs/${r.job.slug}`} className="hover:underline">{r.job.title}</Link> : r.company ? <Link href={`/companies/${r.company.slug}`} className="hover:underline">{r.company.name}</Link> : r.contact ? `${r.contact.firstName} ${r.contact.lastName} (${r.contact.company.name})` : "—"}</TableCell>
              <TableCell className="max-w-xs text-xs text-muted-foreground">{r.details ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.user?.email ?? "anonyme"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</TableCell>
              <TableCell><Badge variant={r.status === "OPEN" ? "warning" : r.status === "RESOLVED" ? "success" : "muted"}>{r.status}</Badge></TableCell>
              <TableCell><ReportActions reportId={r.id} status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

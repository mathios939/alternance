import Link from "next/link";
import { listJobsAdmin } from "@/features/admin/server/queries";
import { AdminSearch } from "@/features/admin/components/admin-search";
import { JobRowActions } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPublishedAgo } from "@/lib/format";

export default async function AdminJobsPage(props: PageProps<"/admin/jobs">) {
  const params = await props.searchParams;
  const q = typeof params["q"] === "string" ? params["q"] : "";
  const page = Number(params["page"] ?? 1) || 1;
  const { items, total } = await listJobsAdmin(page, q);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><AdminSearch placeholder="Rechercher une offre ou une entreprise" basePath="/admin/jobs" /><p className="text-sm text-muted-foreground">{total} offres</p></div>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Offre</TableHead><TableHead>Entreprise</TableHead><TableHead>Ville</TableHead><TableHead>Source</TableHead><TableHead>Publiée</TableHead><TableHead>Cand.</TableHead><TableHead>Sign.</TableHead><TableHead>État</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((j) => (
              <TableRow key={j.id}>
                <TableCell><Link href={`/jobs/${j.slug}`} className="font-medium hover:underline">{j.title}</Link>{j.isDemo ? <Badge variant="warning" className="ml-2">Démo</Badge> : null}{j.canonicalJobId ? <Badge variant="muted" className="ml-2">Doublon {j.duplicateConfidence} %</Badge> : null}</TableCell>
                <TableCell><Link href={`/companies/${j.company.slug}`} className="hover:underline">{j.company.name}</Link></TableCell>
                <TableCell>{j.city}</TableCell>
                <TableCell className="text-xs">{j.source}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatPublishedAgo(j.publishedAt)}</TableCell>
                <TableCell className="tabular-nums">{j._count.applications}</TableCell>
                <TableCell className="tabular-nums">{j._count.reports}</TableCell>
                <TableCell><Badge variant={j.isActive ? "success" : "muted"}>{j.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell><JobRowActions jobId={j.id} isActive={j.isActive} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

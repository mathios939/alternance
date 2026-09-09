import { prisma } from "@/lib/db";
import { getJobSourceProviders } from "@/services/job-sources";
import { SourceActions } from "@/features/admin/components/admin-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { formatRelative } from "@/lib/format";

export default async function AdminSourcesPage() {
  const [sources, statuses] = await Promise.all([prisma.jobSource.findMany({ orderBy: { name: "asc" } }), Promise.all(getJobSourceProviders().map((p) => p.status()))]);
  const statusByKey = new Map(statuses.map((s) => [s.key, s]));
  return (
    <div className="space-y-4">
      <Alert variant="info"><Info /><AlertDescription>Seules des sources légales sont intégrées : API officielle France Travail (identifiants partenaires), flux carrières fournis par les entreprises, saisie manuelle. Aucun scraping en violation des CGU d'un site.</AlertDescription></Alert>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Type</TableHead><TableHead>Configuration</TableHead><TableHead>Dernière synchro</TableHead><TableHead>Offres</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {sources.map((s) => {
              const st = statusByKey.get(s.key);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}<p className="text-xs font-normal text-muted-foreground">{s.key}</p></TableCell>
                  <TableCell className="text-xs">{s.type}</TableCell>
                  <TableCell>{st?.configured ? <Badge variant="success">Configurée</Badge> : <span className="text-xs text-muted-foreground">{st?.reason ?? "Provider absent"}</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground"><Badge variant={s.lastSyncStatus === "SUCCESS" ? "success" : s.lastSyncStatus === "ERROR" ? "destructive" : "muted"} className="mr-2">{s.lastSyncStatus}</Badge>{s.lastSyncAt ? formatRelative(s.lastSyncAt) : "jamais"}{s.lastSyncError ? <p className="mt-1 text-destructive">{s.lastSyncError}</p> : null}</TableCell>
                  <TableCell className="tabular-nums">{s.jobsCount}</TableCell>
                  <TableCell><SourceActions sourceId={s.id} sourceKey={s.key} isEnabled={s.isEnabled} configured={Boolean(st?.configured)} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { prisma } from "@/lib/db";
import { getJobSourceProviders } from "@/services/job-sources";
import { SourceActions } from "@/features/admin/components/admin-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { getProviderMetrics } from "@/features/sources/server/queries";

export default async function AdminSourcesPage() {
  const [sources, statuses, metrics] = await Promise.all([
    prisma.jobSource.findMany({ orderBy: { name: "asc" } }),
    Promise.all(getJobSourceProviders().map((p) => p.status())),
    getProviderMetrics(),
  ]);
  const statusByKey = new Map(statuses.map((s) => [s.key, s]));
  const fmtMinutes = (m: number | null) =>
    m === null
      ? "jamais"
      : m < 60
        ? `il y a ${m} min`
        : m < 48 * 60
          ? `il y a ${Math.round(m / 60)} h`
          : `il y a ${Math.round(m / 1440)} j`;
  return (
    <div className="space-y-4">
      <Alert variant="info">
        <Info />
        <AlertDescription>
          Seules des sources légales sont intégrées : API officielle France Travail (identifiants
          partenaires), API Alternance « La bonne alternance » du Ministère du Travail (clé d'API,
          licence Etalab-2.0 ; les offres qu'elle relaie depuis France Travail sont ignorées), flux
          carrières fournis par les entreprises, saisie manuelle. Aucun scraping en violation des
          CGU d'un site.
        </AlertDescription>
      </Alert>
      <section className="surface overflow-hidden" aria-labelledby="providers-metrics">
        <h3 id="providers-metrics" className="border-b px-4 py-3 font-semibold">
          Fournisseurs : statut, fraîcheur, apport, erreurs, latence
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernier succès</TableHead>
              <TableHead>Offres actives</TableHead>
              <TableHead>Nouvelles 24 h</TableHead>
              <TableHead>Uniques</TableHead>
              <TableHead>Partagées (doublons inter-sources)</TableHead>
              <TableHead>Erreurs 24 h</TableHead>
              <TableHead>Latence moyenne</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">
                  {m.name}
                  <p className="text-muted-foreground text-xs font-normal">
                    {m.key} · {m.type}
                  </p>
                </TableCell>
                <TableCell>
                  {m.configured ? (
                    <Badge
                      variant={
                        m.status === "ERROR"
                          ? "destructive"
                          : m.status === "SUCCESS"
                            ? "success"
                            : "muted"
                      }
                    >
                      {m.status}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {m.reason ?? "non configurée"}
                    </span>
                  )}
                  {m.lastError ? (
                    <p
                      className="text-destructive mt-1 max-w-xs truncate text-xs"
                      title={m.lastError}
                    >
                      {m.lastError}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {fmtMinutes(m.freshnessMinutes)}
                  {m.lastErrorAt ? <p>dernière erreur {formatRelative(m.lastErrorAt)}</p> : null}
                </TableCell>
                <TableCell className="tabular-nums">{m.activeJobs}</TableCell>
                <TableCell className="tabular-nums">{m.newJobs24h}</TableCell>
                <TableCell className="tabular-nums">{m.uniqueJobs}</TableCell>
                <TableCell className="tabular-nums">{m.sharedJobs}</TableCell>
                <TableCell className="tabular-nums">
                  {m.errors24h}
                  <span className="text-muted-foreground text-xs"> / {m.runs24h} exéc.</span>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {m.averageLatencyMs !== null
                    ? `${(m.averageLatencyMs / 1000).toFixed(1)} s`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead>Dernière synchro</TableHead>
              <TableHead>Offres</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => {
              const st = statusByKey.get(s.key);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    <p className="text-muted-foreground text-xs font-normal">{s.key}</p>
                  </TableCell>
                  <TableCell className="text-xs">{s.type}</TableCell>
                  <TableCell>
                    {st?.configured ? (
                      <Badge variant="success">Configurée</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {st?.reason ?? "Provider absent"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <Badge
                      variant={
                        s.lastSyncStatus === "SUCCESS"
                          ? "success"
                          : s.lastSyncStatus === "ERROR"
                            ? "destructive"
                            : "muted"
                      }
                      className="mr-2"
                    >
                      {s.lastSyncStatus}
                    </Badge>
                    {s.lastSyncAt ? formatRelative(s.lastSyncAt) : "jamais"}
                    {s.lastSyncError ? (
                      <p className="text-destructive mt-1">{s.lastSyncError}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{s.jobsCount}</TableCell>
                  <TableCell>
                    <SourceActions
                      sourceId={s.id}
                      sourceKey={s.key}
                      isEnabled={s.isEnabled}
                      configured={Boolean(st?.configured)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { AlertTriangle, Building2, Briefcase, Copy, Users } from "lucide-react";
import { getDataQualityStats, getSourcesOverview } from "@/features/sources/server/queries";
import { DataOpsActions } from "@/features/admin/components/data-ops-actions";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Qualité des données", robots: { index: false } };

export default async function AdminDataPage() {
  const [stats, overview] = await Promise.all([getDataQualityStats(), getSourcesOverview()]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Qualité des données</h2>
          <p className="text-sm text-muted-foreground">{stats.demoMode ? "Mode démonstration actif (DEMO_MODE) : les données fictives sont visibles par les utilisateurs." : "Mode démonstration désactivé : seules les données réelles sont visibles."}</p>
        </div>
        <DataOpsActions sources={overview.sources.map((s) => ({ key: s.key, name: s.name, configured: s.configured, supportsVerification: s.capabilities.supportsVerification }))} companyProviderConfigured={overview.companyProviders.some((p) => p.configured)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Offres réelles actives" value={stats.jobs.activeReal} hint={`${stats.jobs.real} réelles au total · ${stats.jobs.demo} démo`} icon={Briefcase} tone="info" />
        <StatCard label="Non vérifiées depuis 7 j" value={stats.jobs.unverified7d} hint={`${stats.jobs.unknown} « non re-vérifiée » · ${stats.jobs.expired} expirées · ${stats.jobs.removed} retirées`} icon={AlertTriangle} tone="warning" />
        <StatCard label="Doublons rattachés" value={stats.duplicates.attached} hint={`${stats.duplicates.probable} probables masqués à vérifier`} icon={Copy} />
        <StatCard label="Entreprises réelles" value={stats.companies.real} hint={`${stats.companies.withSiren} avec SIREN · ${stats.companies.demo} démo`} icon={Building2} tone="success" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contacts vérifiés (réels)" value={stats.contacts.verified} hint={`${stats.contacts.demo} démo · ${stats.contacts.optOut} oppositions`} icon={Users} />
        <StatCard label="Offres à employeur non communiqué" value={stats.jobs.anonymousEmployer} hint="rattachées à la fiche technique" icon={Building2} tone="warning" />
        <StatCard label="Qualité < 50" value={stats.jobs.lowQuality} hint="données insuffisantes (score calculé)" icon={AlertTriangle} tone="warning" />
      </div>

      <section className="surface overflow-hidden">
        <h3 className="border-b px-4 py-3 font-semibold">Sources et dernière ingestion</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>État</TableHead><TableHead>Offres actives</TableHead><TableHead>Dernière exécution</TableHead><TableHead>Résultat</TableHead></TableRow></TableHeader>
          <TableBody>
            {overview.sources.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="font-medium">{s.name}<p className="text-xs font-normal text-muted-foreground">{s.key} · priorité {s.priority}</p></TableCell>
                <TableCell>{s.configured ? <Badge variant="success">Configurée</Badge> : <span className="text-xs text-muted-foreground">{s.missing.length ? `Manque ${s.missing.join(", ")}` : s.reason}</span>}</TableCell>
                <TableCell className="tabular-nums">{s.activeJobs}<span className="text-xs text-muted-foreground"> / {s.totalEntries} entrées</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.lastRun ? `${formatRelative(s.lastRun.startedAt)} · ${s.lastRun.status}` : "jamais"}</TableCell>
                <TableCell className="text-xs">{s.lastRun ? `${s.lastRun.fetchedCount} récupérées · ${s.lastRun.createdCount} créées · ${s.lastRun.updatedCount} MAJ · ${s.lastRun.duplicateCount} doublons · ${s.lastRun.rejectedCount} rejetées · ${s.lastRun.failedCount} erreurs` : "—"}{s.lastRun?.errorSummary ? <p className="mt-1 text-destructive">{s.lastRun.errorSummary}</p> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="surface overflow-hidden">
        <h3 className="border-b px-4 py-3 font-semibold">Journal des exécutions (25 dernières)</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Début</TableHead><TableHead>Source</TableHead><TableHead>Déclencheur</TableHead><TableHead>Statut</TableHead><TableHead>Compteurs</TableHead><TableHead>Durée</TableHead></TableRow></TableHeader>
          <TableBody>
            {stats.runs.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Aucune exécution enregistrée. Lance `npm run jobs:sync` ou utilise les boutons ci-dessus.</TableCell></TableRow> : null}
            {stats.runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.startedAt, "d MMM HH:mm")}</TableCell>
                <TableCell className="text-xs font-medium">{r.sourceKey}</TableCell>
                <TableCell className="text-xs">{r.trigger}</TableCell>
                <TableCell><Badge variant={r.status === "SUCCESS" ? "success" : r.status === "ERROR" ? "destructive" : r.status === "PARTIAL" ? "warning" : "muted"}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs tabular-nums">{r.fetchedCount} récup. · {r.createdCount} créées · {r.updatedCount} MAJ · {r.duplicateCount} doublons · {r.rejectedCount} rejets · {r.failedCount} erreurs · {r.expiredCount} expirées{r.errorSummary ? <p className="text-destructive">{r.errorSummary}</p> : null}</TableCell>
                <TableCell className="text-xs tabular-nums">{r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import {
  AlertTriangle,
  Building2,
  Briefcase,
  Copy,
  Globe2,
  Map,
  RefreshCw,
  Users,
} from "lucide-react";
import { getDataQualityStats, getSourcesOverview } from "@/features/sources/server/queries";
import { getCoverageReport } from "@/services/ingestion/coverage";
import { recentQuotaUsage } from "@/services/job-sources/quota-store";
import { getQuotaManager } from "@/services/job-sources/quota";
import { DataOpsActions } from "@/features/admin/components/data-ops-actions";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Qualité des données", robots: { index: false } };

export default async function AdminDataPage() {
  const [stats, overview, coverage, quota] = await Promise.all([
    getDataQualityStats(),
    getSourcesOverview(),
    getCoverageReport(),
    recentQuotaUsage("france-travail", 60),
  ]);
  const quotaLimit = getQuotaManager("france-travail").stats().perMinuteLimit;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Qualité des données</h2>
          <p className="text-muted-foreground text-sm">
            {stats.demoMode
              ? "Mode démonstration actif (DEMO_MODE) : les données fictives sont visibles par les utilisateurs."
              : "Mode démonstration désactivé : seules les données réelles sont visibles."}
          </p>
        </div>
        <DataOpsActions
          sources={overview.sources.map((s) => ({
            key: s.key,
            name: s.name,
            configured: s.configured,
            supportsVerification: s.capabilities.supportsVerification,
          }))}
          companyProviderConfigured={overview.companyProviders.some((p) => p.configured)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Offres réelles actives"
          value={stats.jobs.activeReal}
          hint={`${stats.jobs.real} réelles au total · ${stats.jobs.demo} démo`}
          icon={Briefcase}
          tone="info"
        />
        <StatCard
          label="Non vérifiées depuis 7 j"
          value={stats.jobs.unverified7d}
          hint={`${stats.jobs.unknown} « non re-vérifiée » · ${stats.jobs.expired} expirées · ${stats.jobs.removed} retirées`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Doublons rattachés"
          value={stats.duplicates.attached}
          hint={`${stats.duplicates.probable} probables masqués à vérifier`}
          icon={Copy}
        />
        <StatCard
          label="Entreprises réelles"
          value={stats.companies.real}
          hint={`${stats.companies.withSiren} avec SIREN · ${stats.companies.demo} démo`}
          icon={Building2}
          tone="success"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Contacts vérifiés (réels)"
          value={stats.contacts.verified}
          hint={`${stats.contacts.demo} démo · ${stats.contacts.optOut} oppositions`}
          icon={Users}
        />
        <StatCard
          label="Offres à employeur non communiqué"
          value={stats.jobs.anonymousEmployer}
          hint="rattachées à la fiche technique"
          icon={Building2}
          tone="warning"
        />
        <StatCard
          label="Qualité < 50"
          value={stats.jobs.lowQuality}
          hint="données insuffisantes (score calculé)"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <section className="surface overflow-hidden" aria-labelledby="national-coverage">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h3 id="national-coverage" className="font-semibold">
            Couverture nationale — France Travail
          </h3>
          <p className="text-muted-foreground text-xs">
            Dernier sync :{" "}
            {coverage.territories.lastSyncAt
              ? formatRelative(new Date(coverage.territories.lastSyncAt))
              : "jamais"}{" "}
            · quota : {quota.requests} req / 60 min (pic {quota.peakPerMinute}/min, plafond{" "}
            {quotaLimit}/min)
          </p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Offres actives"
            value={coverage.activeAlternance}
            hint={`${coverage.totalOffers} offres réelles en base (historique compris)`}
            icon={Briefcase}
            tone="info"
          />
          <StatCard
            label="Nouvelles 24 h"
            value={coverage.last24h}
            hint={`${coverage.discovered24h} découvertes < 24 h · ${coverage.last7Days} publiées < 7 j`}
            icon={RefreshCw}
            tone="success"
          />
          <StatCard
            label="Départements synchronisés"
            value={`${coverage.territories.synced24h} / ${coverage.territories.total}`}
            hint={`< 24 h · ${coverage.territories.syncedEver} au moins une fois · ${coverage.territories.inProgress} en cours`}
            icon={Map}
          />
          <StatCard
            label="Erreurs"
            value={coverage.territories.errors}
            hint={`${coverage.territories.late} territoire(s) en retard (> 24 h) · ${coverage.removed7Days} retirées / ${coverage.expired7Days} expirées sur 7 j`}
            icon={AlertTriangle}
            tone={coverage.territories.errors > 0 ? "warning" : "success"}
          />
        </div>
        {coverage.territories.lastError ? (
          <p className="text-destructive px-4 pb-3 text-xs">
            Dernière erreur : {coverage.territories.lastError}
          </p>
        ) : null}
        <div className="grid gap-0 border-t md:grid-cols-2">
          <div>
            <h4 className="text-muted-foreground px-4 py-2 text-xs font-semibold uppercase">
              Par région
            </h4>
            <Table>
              <TableBody>
                {coverage.byRegion.slice(0, 18).map((r) => (
                  <TableRow key={r.region}>
                    <TableCell className="text-xs">{r.region}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.count}</TableCell>
                  </TableRow>
                ))}
                {coverage.byRegion.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      Aucune offre réelle active.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="md:border-l">
            <h4 className="text-muted-foreground px-4 py-2 text-xs font-semibold uppercase">
              Départements les mieux couverts
            </h4>
            <Table>
              <TableBody>
                {coverage.byDepartment.slice(0, 18).map((d) => (
                  <TableRow key={d.code}>
                    <TableCell className="text-xs">
                      {d.code} · {d.department}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{d.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 border-t px-4 py-2 text-xs">
          <Globe2 className="size-3.5" aria-hidden /> Fenêtres :{" "}
          {coverage.territories.windows
            .map(
              (w) =>
                `${w.window} → ${w.synced24h} depuis moins de 24 h / ${w.syncedEver} au moins une fois`,
            )
            .join(" · ") || "aucune synchronisation nationale enregistrée"}{" "}
          · recherches live : {coverage.liveSearches.total} ({coverage.liveSearches.refreshed24h}{" "}
          rafraîchies &lt; 24 h)
        </p>
      </section>

      <section className="surface overflow-hidden">
        <h3 className="border-b px-4 py-3 font-semibold">Sources et dernière ingestion</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Offres actives</TableHead>
              <TableHead>Dernière exécution</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.sources.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="font-medium">
                  {s.name}
                  <p className="text-muted-foreground text-xs font-normal">
                    {s.key} · priorité {s.priority}
                  </p>
                </TableCell>
                <TableCell>
                  {s.configured ? (
                    <Badge variant="success">Configurée</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {s.missing.length ? `Manque ${s.missing.join(", ")}` : s.reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {s.activeJobs}
                  <span className="text-muted-foreground text-xs"> / {s.totalEntries} entrées</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {s.lastRun
                    ? `${formatRelative(s.lastRun.startedAt)} · ${s.lastRun.status}`
                    : "jamais"}
                </TableCell>
                <TableCell className="text-xs">
                  {s.lastRun
                    ? `${s.lastRun.fetchedCount} récupérées · ${s.lastRun.createdCount} créées · ${s.lastRun.updatedCount} MAJ · ${s.lastRun.duplicateCount} doublons · ${s.lastRun.rejectedCount} rejetées · ${s.lastRun.failedCount} erreurs`
                    : "—"}
                  {s.lastRun?.errorSummary ? (
                    <p className="text-destructive mt-1">{s.lastRun.errorSummary}</p>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="surface overflow-hidden">
        <h3 className="border-b px-4 py-3 font-semibold">Journal des exécutions (25 dernières)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Début</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Déclencheur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Compteurs</TableHead>
              <TableHead>Durée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center text-sm">
                  Aucune exécution enregistrée. Lance `npm run jobs:sync` ou utilise les boutons
                  ci-dessus.
                </TableCell>
              </TableRow>
            ) : null}
            {stats.runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.startedAt, "d MMM HH:mm")}</TableCell>
                <TableCell className="text-xs font-medium">{r.sourceKey}</TableCell>
                <TableCell className="text-xs">{r.trigger}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === "SUCCESS"
                        ? "success"
                        : r.status === "ERROR"
                          ? "destructive"
                          : r.status === "PARTIAL"
                            ? "warning"
                            : "muted"
                    }
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {r.fetchedCount} récup. · {r.createdCount} créées · {r.updatedCount} MAJ ·{" "}
                  {r.duplicateCount} doublons · {r.rejectedCount} rejets · {r.failedCount} erreurs ·{" "}
                  {r.expiredCount} expirées
                  {r.errorSummary ? <p className="text-destructive">{r.errorSummary}</p> : null}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

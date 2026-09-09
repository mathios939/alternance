import type { Metadata } from "next";
import { Briefcase, Building2, FileText, Flag, KanbanSquare, Users, UserRound } from "lucide-react";
import { getAdminStats } from "@/features/admin/server/queries";
import { StatCard } from "@/components/shared/stat-card";
import { formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

export default async function AdminPage() {
  const s = await getAdminStats();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs" value={s.users} hint={`+${s.newUsers} sur 7 jours`} icon={Users} href="/admin/users" />
        <StatCard label="Offres actives" value={s.activeJobs} hint={`${s.jobs} au total`} icon={Briefcase} href="/admin/jobs" tone="info" />
        <StatCard label="Entreprises" value={s.companies} hint={`${s.contacts} contacts actifs`} icon={Building2} href="/admin/companies" tone="success" />
        <StatCard label="Signalements ouverts" value={s.reportsOpen} hint={`${s.applications} candidatures suivies · ${s.docs} documents IA`} icon={Flag} href="/admin/reports" tone="warning" />
      </div>
      <section className="surface p-5">
        <h2 className="font-semibold">Sources d'offres</h2>
        <ul className="mt-3 divide-y text-sm">
          {s.sources.map((src) => (
            <li key={src.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium">{src.name}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={src.lastSyncStatus === "SUCCESS" ? "success" : src.lastSyncStatus === "ERROR" ? "destructive" : "muted"}>{src.lastSyncStatus}</Badge>
                {src.lastSyncAt ? `synchro ${formatRelative(src.lastSyncAt)}` : "jamais synchronisée"} · {src.jobsCount} offres
              </span>
            </li>
          ))}
        </ul>
      </section>
      <KanbanSquare className="hidden" aria-hidden /><FileText className="hidden" aria-hidden /><UserRound className="hidden" aria-hidden />
    </div>
  );
}

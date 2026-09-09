import type { Metadata } from "next";
import { Info, Send, MessageSquare, CalendarClock, Award, RefreshCw, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getAnalytics, MIN_SAMPLE } from "@/features/analytics/server/queries";
import { WeeklyChart, StatusBars } from "@/features/analytics/components/analytics-charts";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Statistiques" };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const a = await getAnalytics(user.id);
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Statistiques" description="Ce que tes candidatures produisent, sans conclusion hâtive quand les données sont trop peu nombreuses." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Candidatures envoyées" value={a.totals.sent} hint={`${a.totals.applications} suivies au total`} icon={Send} tone="primary" />
        <StatCard label="Réponses" value={a.totals.responses} hint={a.sampleOk && a.rates.response !== null ? `taux de réponse ${a.rates.response} %` : `taux affiché à partir de ${MIN_SAMPLE} envois`} icon={MessageSquare} tone="info" />
        <StatCard label="Entretiens" value={a.totals.interviews} hint={a.sampleOk && a.rates.interview !== null ? `${a.rates.interview} % des envois` : "obtenus"} icon={CalendarClock} tone="success" />
        <StatCard label="Offres reçues" value={a.totals.offers} hint={`${a.totals.followUps} relance${a.totals.followUps > 1 ? "s" : ""} envoyée${a.totals.followUps > 1 ? "s" : ""}`} icon={Award} tone="warning" />
      </div>
      {!a.sampleOk ? (
        <Alert variant="info">
          <Info />
          <AlertDescription>Avec moins de {MIN_SAMPLE} candidatures envoyées, les taux ne sont pas significatifs : ils ne sont pas affichés pour éviter de fausses conclusions. Continue à candidater, les tendances apparaîtront.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-5">
          <h2 className="font-semibold">Candidatures par semaine</h2>
          <p className="text-xs text-muted-foreground">Envoyées et réponses reçues, 8 dernières semaines.</p>
          <div className="mt-4"><WeeklyChart data={a.perWeek} /></div>
        </section>
        <section className="surface p-5">
          <h2 className="font-semibold">Répartition par statut</h2>
          <p className="text-xs text-muted-foreground">Où en sont tes {a.totals.applications} candidatures.</p>
          <div className="mt-4"><StatusBars data={a.byStatus} /></div>
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-semibold">Sources les plus efficaces</h2>
          <p className="text-xs text-muted-foreground">Taux de réponse par origine de l'offre.</p>
          {a.bySource.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Aucune candidature envoyée pour le moment.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Envoyées</TableHead><TableHead className="text-right">Réponses</TableHead><TableHead className="text-right">Taux</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.bySource.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="font-medium">{s.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.responses}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.sent >= MIN_SAMPLE ? `${s.rate} %` : <span className="text-muted-foreground" title={`Moins de ${MIN_SAMPLE} envois`}>—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        <section className="surface p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" aria-hidden /> Lecture</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {a.avgMatch !== null ? <li>Compatibilité moyenne des offres où tu as candidaté : <strong>{a.avgMatch} %</strong>{a.avgMatchResponded !== null && a.sampleOk ? <> · celles qui ont répondu : <strong>{a.avgMatchResponded} %</strong></> : null}.</li> : <li className="text-muted-foreground">Le score de compatibilité s'enregistre à chaque candidature ajoutée depuis une offre.</li>}
            <li className="inline-flex items-center gap-2"><RefreshCw className="size-4 text-muted-foreground" aria-hidden /> {a.totals.followUps} relance{a.totals.followUps > 1 ? "s" : ""} envoyée{a.totals.followUps > 1 ? "s" : ""} : la relance à 7 jours reste le levier le moins coûteux.</li>
            <li>{a.totals.favorites} favoris · {a.totals.docs} documents générés · {a.totals.jobsViewed} sessions de consultation d'offres.</li>
            {a.sampleOk && a.rates.response !== null ? <li>{a.rates.response < 15 ? "Taux de réponse bas : personnalise davantage chaque candidature et vise des offres à plus de 80 %." : a.rates.response < 35 ? "Taux de réponse correct : garde ce niveau de ciblage et relance systématiquement." : "Excellent taux de réponse : concentre-toi sur la préparation des entretiens."}</li> : null}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}

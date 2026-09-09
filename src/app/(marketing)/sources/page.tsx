import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Database, Flag, Gauge, ShieldCheck } from "lucide-react";
import { getSourcesOverview } from "@/features/sources/server/queries";
import { EXPIRATION_RULES } from "@/services/ingestion/expire";
import { PageContainer } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sources des données",
  description: "D'où viennent les offres, les entreprises et les contacts affichés, quand ils ont été mis à jour, et ce qui est estimé.",
};

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { FRANCE_TRAVAIL: "API officielle", COMPANY_CAREER: "Flux carrières fournis", ATS: "ATS public", MANUAL: "Saisie manuelle", PARTNER: "Partenaire", OTHER: "Autre" };

export default async function SourcesPage() {
  const { sources, companyProviders, demoMode, lastRunAt } = await getSourcesOverview();
  return (
    <PageContainer className="max-w-4xl space-y-10 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">D'où viennent les données</h1>
        <p className="text-muted-foreground">Chaque offre, entreprise ou contact affiché indique sa source et sa date de vérification. Nous n'inventons jamais une donnée manquante : elle reste vide. Dernière mise à jour réussie : {lastRunAt ? `${formatRelative(lastRunAt)} (${formatDate(lastRunAt, "d MMM yyyy 'à' HH:mm")})` : "aucune ingestion réelle enregistrée pour l'instant"}.</p>
        {demoMode ? <Badge variant="warning">Mode démonstration actif : des offres, entreprises et contacts fictifs, marqués « Démo », sont affichés à côté des données réelles.</Badge> : <Badge variant="success">Mode démonstration désactivé : uniquement des données réelles.</Badge>}
      </header>

      <section className="space-y-4">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold"><Database className="size-5 text-primary" aria-hidden /> Sources d'offres</h2>
        <div className="space-y-3">
          {sources.map((s) => (
            <article key={s.key} className="surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{s.name} <span className="text-xs font-normal text-muted-foreground">· {TYPE_LABELS[s.type] ?? s.type}</span></p>
                {s.configured ? <Badge variant="success"><CheckCircle2 aria-hidden /> Active</Badge> : <Badge variant="muted"><CircleDashed aria-hidden /> Non configurée</Badge>}
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Offres actives issues de cette source</dt><dd className="font-medium tabular-nums">{s.activeJobs}</dd></div>
                <div><dt className="text-muted-foreground">Dernière synchronisation</dt><dd className="font-medium">{s.lastSyncAt ? `${formatRelative(s.lastSyncAt)} · ${s.lastSyncStatus.toLowerCase()}` : "jamais"}</dd></div>
                {s.lastRun ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Dernière exécution</dt><dd>{s.lastRun.fetchedCount} récupérées · {s.lastRun.createdCount} nouvelles · {s.lastRun.updatedCount} mises à jour · {s.lastRun.duplicateCount} rattachées (doublons) · {s.lastRun.rejectedCount} rejetées</dd></div> : null}
                {!s.configured && s.reason ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Pourquoi</dt><dd className="text-xs">{s.reason}</dd></div> : null}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Capacités : {[s.capabilities.supportsSearch && "recherche", s.capabilities.supportsRadius && "rayon géographique", s.capabilities.supportsDetails && "détail", s.capabilities.supportsSalary && "salaire", s.capabilities.supportsVerification && "vérification des retraits", s.capabilities.supportsExpiration && "date d'expiration"].filter(Boolean).join(" · ") || "aucune déclarée"}.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="size-5 text-primary" aria-hidden /> Entreprises et contacts</h2>
        <ul className="space-y-2 text-sm">
          {companyProviders.map((p) => (
            <li key={p.key} className="surface flex flex-wrap items-center justify-between gap-2 p-3"><span>{p.name}</span>{p.configured ? <Badge variant="success">Active</Badge> : <Badge variant="muted">{p.reason ?? "Non configurée"}</Badge>}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Les fiches entreprises proviennent des offres officielles (nom, site web et logo publiés par l'employeur) et de l'open data SIRENE (raison sociale, SIREN, adresse, tranche d'effectif, code NAF). Les contacts nominatifs proviennent uniquement du bloc « contact » publié par l'annonceur dans une offre officielle ; chaque personne peut demander son retrait. Aucun profil LinkedIn n'est collecté, aucun e-mail n'est deviné.</p>
      </section>

      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold"><Gauge className="size-5 text-primary" aria-hidden /> Ce qui est estimé</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Match Score</strong> : règles explicites sur ton profil et l'offre ; un critère absent de l'offre est exclu du calcul, jamais compté contre toi.</li>
          <li><strong className="text-foreground">Potentiel d'une entreprise</strong> (Radar) : estimation à partir de la proximité, du secteur, des offres publiées et de l'historique connu. Toujours marqué « Estimation ».</li>
          <li><strong className="text-foreground">Temps de trajet</strong> : distance à vol d'oiseau et vitesse moyenne, sauf fournisseur d'itinéraires configuré (alors « itinéraire »).</li>
          <li><strong className="text-foreground">Niveau, rythme, télétravail</strong> : déduits du texte de l'annonce quand la source ne les structure pas ; « non précisé » sinon.</li>
          <li><strong className="text-foreground">Fraîcheur</strong> : une offre est re-vérifiée auprès de sa source ; au-delà de {EXPIRATION_RULES.staleAfterDays} jours sans vérification elle est signalée « non re-vérifiée », au-delà de {EXPIRATION_RULES.expireUnverifiedAfterDays} jours elle est retirée.</li>
        </ul>
      </section>

      <section className="surface space-y-2 p-4 text-sm">
        <h2 className="inline-flex items-center gap-2 font-semibold"><Flag className="size-4 text-primary" aria-hidden /> Signaler une erreur</h2>
        <p className="text-muted-foreground">Offre expirée, entreprise mal identifiée, contact inexact : utilise le bouton « Signaler » présent sur chaque fiche. Les signalements sont traités dans l'administration et une offre expirée confirmée est retirée. Pour une demande de retrait de données personnelles, voir la <Link href="/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>.</p>
      </section>
    </PageContainer>
  );
}

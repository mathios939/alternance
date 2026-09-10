import Link from "next/link";
import { ArrowRight, Bot, FileText, KanbanSquare, MapPin, Radar, Search, Sparkles, Target, BellRing, CalendarClock, BarChart3, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_CITIES } from "@/config/cities";

export function KeyFigures({ stats }: { stats: { jobs: number; companies: number; cities: number; last24h: number } }) {
  const items = [
    { value: stats.jobs, label: "offres d'alternance actives", hint: "dédoublonnées et normalisées" },
    { value: stats.companies, label: "entreprises à contacter", hint: "avec ou sans offre publiée" },
    { value: stats.last24h, label: "nouvelles offres en 24 h", hint: "mises à jour en continu" },
    { value: 92, label: "% de compatibilité max", hint: "calculé sur ton profil", suffix: "" },
  ];
  return (
    <section className="border-y bg-card/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{it.value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-sm font-medium">{it.label}</p>
            <p className="text-xs text-muted-foreground">{it.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Target, title: "Cherche, sans compte", text: "Métier, ville, rayon : les offres s'affichent tout de suite. Trente secondes de plus pour un score personnalisé, toujours sans compte." },
  { icon: Sparkles, title: "Reçois tes opportunités triées", text: "Chaque offre reçoit un score de compatibilité expliqué. Le Radar repère les entreprises qui recrutent sans annonce." },
  { icon: KanbanSquare, title: "Candidate, suis, relance", text: "Un tableau de suivi, des relances programmées, des lettres et messages générés à partir de ton profil." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" id="fonctionnement">
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Fonctionnement</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Un assistant, pas un énième jobboard</h2>
        <p className="mt-3 text-muted-foreground">Tu n'as plus à jongler entre dix sites et un tableur. Le produit trie, priorise et te dit quoi faire maintenant.</p>
      </div>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="surface relative p-6">
            <span className="absolute top-5 right-5 text-4xl font-semibold text-muted-foreground/20 tabular-nums" aria-hidden>
              0{i + 1}
            </span>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <s.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FEATURES = [
  { icon: Search, title: "Moteur multi-sources", text: "Offres agrégées et dédoublonnées, filtres précis (rayon, niveau, rythme, télétravail, fraîcheur)." },
  { icon: Target, title: "Match Score expliqué", text: "Formation, compétences, distance, rythme : tu sais pourquoi une offre te correspond, et ce qui manque." },
  { icon: Radar, title: "Opportunity Radar", text: "Les entreprises qui accueillent des alternants près de chez toi, même sans offre publiée." },
  { icon: KanbanSquare, title: "Suivi des candidatures", text: "Kanban, historique, prochaine action, relances recommandées à 7 jours. Rien n'est envoyé sans toi." },
  { icon: FileText, title: "CV analysé et adapté", text: "Score de CV, points forts, points faibles, adaptation à chaque offre sans jamais inventer." },
  { icon: Bot, title: "Copilote IA contextuel", text: "« Prépare mon entretien », « pourquoi mes candidatures ne marchent pas ? » : il connaît ton dossier." },
  { icon: MapPin, title: "Carte et trajets", text: "Offres et entreprises sur une carte, estimation des temps domicile ↔ entreprise ↔ école." },
  { icon: BellRing, title: "Alertes utiles", text: "Nouvelle offre très compatible, relance à faire, entretien qui approche. Pas de bruit." },
  { icon: CalendarClock, title: "Préparation d'entretien", text: "Résumé de l'entreprise, questions probables, points à mettre en avant, questions à poser." },
  { icon: BarChart3, title: "Statistiques honnêtes", text: "Taux de réponse, candidatures par semaine, sources efficaces. Sans conclusion hâtive sur 3 données." },
  { icon: Flame, title: "Mode urgence", text: "Un plan intensif jour par jour quand il faut signer vite, en gardant la qualité." },
  { icon: Sparkles, title: "Prochaine meilleure action", text: "À tout moment, l'action la plus utile est proposée. Fini la paralysie." },
];

export function Features() {
  return (
    <section className="border-t bg-card/40" id="fonctionnalites">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Fonctionnalités</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tout ce qu'il faut pour obtenir des entretiens</h2>
          <p className="mt-3 text-muted-foreground">Chaque fonctionnalité sert un seul objectif : réduire le temps nécessaire pour signer ton contrat.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface surface-hover p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { name: "Inès, BTS SIO à Nantes", text: "J'ai arrêté d'ouvrir cinq onglets tous les matins. Le score m'a fait candidater à des offres que j'aurais ignorées, et j'ai eu deux entretiens en dix jours.", role: "Développeuse en alternance" },
  { name: "Mathis, BUT TC à Rennes", text: "Le Radar m'a sorti une PME à 12 km qui n'avait aucune annonce. Candidature spontanée, réponse en 48 h.", role: "Business developer en alternance" },
  { name: "Clara, Master RH à Angers", text: "Les relances programmées, c'est ce qui a fait la différence. Je n'oubliais plus personne, et deux entreprises m'ont rappelée après une relance.", role: "Chargée de recrutement en alternance" },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Témoignages</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Ce que ça change au quotidien</h2>
        </div>
        <Badge variant="warning">Témoignages fictifs — données de démonstration</Badge>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="surface flex flex-col p-6">
            <blockquote className="flex-1 text-[15px] leading-relaxed">« {t.text} »</blockquote>
            <figcaption className="mt-5 border-t pt-4">
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function CityLinks() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <p className="text-sm font-medium text-muted-foreground">Alternance par ville</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRIORITY_CITIES.map((c) => (
          <Link key={c.slug} href={`/alternance/${c.slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary">
            {c.name}
          </Link>
        ))}
        {["paris", "lyon", "bordeaux", "lille", "toulouse"].map((slug) => (
          <Link key={slug} href={`/alternance/${slug}`} className="rounded-full border bg-card px-3 py-1.5 text-sm capitalize transition-colors hover:border-primary hover:text-primary">
            {slug}
          </Link>
        ))}
      </div>
    </section>
  );
}

const ACCOUNT_PERKS = ["synchroniser tes favoris", "conserver ton profil et plusieurs CV", "suivre tes candidatures et tes relances", "recevoir des alertes utiles", "garder tes conversations avec le Copilote", "retrouver ton historique sur tous tes appareils"];

/** Le compte est un avantage, pas une barrière : tout le cœur du site reste utilisable sans lui. */
export function FinalCta({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary to-[oklch(0.55_0.2_300)] px-6 py-16 text-center text-primary-foreground shadow-lg sm:px-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{isAuthenticated ? "Ta mission de demain matin est déjà prête." : "Crée un compte gratuitement pour retrouver tes candidatures sur tous tes appareils."}</h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">{isAuthenticated ? "Demain, tu ouvres une seule page et tu sais exactement quoi faire." : "La recherche, les offres, les entreprises et le Radar restent libres. Le compte sert à :"}</p>
        {!isAuthenticated ? (
          <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2 text-sm">
            {ACCOUNT_PERKS.map((perk) => (
              <li key={perk} className="rounded-full border border-white/25 bg-white/10 px-3 py-1">{perk}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="xl" variant="secondary" className="bg-white text-primary hover:bg-white/90">
            <Link href={isAuthenticated ? "/dashboard" : "/register"}>
              {isAuthenticated ? "Ouvrir mon tableau de bord" : "Créer un compte gratuitement"} <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="xl" variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <Link href="/jobs">{isAuthenticated ? "Voir les offres" : "Continuer sans compte"}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

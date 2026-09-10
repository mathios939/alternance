import Link from "next/link";
import { ArrowRight, Bell, Bookmark, Briefcase, Building2, FileText, KanbanSquare, Map, Radar, Search, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { GuestDashboardStatus } from "./guest-dashboard-status";

const AVAILABLE_NOW = [
  { icon: Briefcase, title: "Chercher des offres", text: "Métier, ville, rayon, filtres et score de compatibilité.", href: "/jobs", cta: "Rechercher" },
  { icon: Building2, title: "Explorer les entreprises", text: "Contacts publics, canaux officiels, candidature spontanée.", href: "/companies", cta: "Explorer" },
  { icon: Radar, title: "Lancer le Radar", text: "Les entreprises qui pourraient t'accueillir, même sans offre.", href: "/radar", cta: "Ouvrir" },
  { icon: Map, title: "Voir la carte", text: "Offres et entreprises autour de toi.", href: "/map", cta: "Afficher" },
];

const WITH_ACCOUNT = [
  { icon: KanbanSquare, title: "Suivre tes candidatures", text: "Kanban, relances recommandées, historique de chaque échange." },
  { icon: Bell, title: "Recevoir tes alertes", text: "Nouvelle offre très compatible, relance à faire, entretien qui approche." },
  { icon: FileText, title: "Sauvegarder ton CV", text: "Plusieurs versions, analysées et adaptées à chaque offre." },
  { icon: Bookmark, title: "Conserver tes favoris", text: "Offres, entreprises et préférences retrouvées sur tous tes appareils." },
];

/**
 * /dashboard sans compte : ni écran vide, ni connexion déguisée. Explique ce qui est déjà possible
 * sans compte, ce que le compte débloque et pourquoi, et laisse vraiment continuer sans compte.
 */
export function GuestDashboard() {
  return (
    <PageContainer className="space-y-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden /> Espace personnel · gratuit, sans obligation
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Ton espace personnel</h1>
        <p className="mt-3 text-muted-foreground">
          Tout le cœur du site fonctionne sans compte : recherche, offres, entreprises, Radar, carte, favoris et candidature via les liens officiels. L'espace personnel ajoute ce qui doit te suivre d'un jour et d'un appareil à l'autre.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register?next=/dashboard">
              Créer mon espace gratuitement <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/jobs">
              <Search aria-hidden /> Continuer sans compte
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/login?next=/dashboard" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>

      <GuestDashboardStatus />

      <section className="mx-auto max-w-4xl space-y-4" aria-labelledby="guest-now">
        <div>
          <h2 id="guest-now" className="text-xl font-semibold">Déjà disponible, sans compte</h2>
          <p className="text-sm text-muted-foreground">Rien à créer pour commencer. Tes préférences et tes favoris restent dans ce navigateur.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {AVAILABLE_NOW.map((item) => (
            <li key={item.title} className="surface flex items-start gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                <item.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {item.cta} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-4xl space-y-4" aria-labelledby="guest-account">
        <div>
          <h2 id="guest-account" className="text-xl font-semibold">Ce qu'un compte gratuit débloque</h2>
          <p className="text-sm text-muted-foreground">Utile dès que ta recherche s'étale sur plusieurs jours ou plusieurs appareils : rien ne se perd, et tu sais toujours quoi faire ensuite.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {WITH_ACCOUNT.map((b) => (
            <li key={b.title} className="surface flex gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <b.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{b.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}

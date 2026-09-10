import Link from "next/link";
import { ArrowRight, Bell, Bookmark, FileText, KanbanSquare, Search, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

const BENEFITS = [
  { icon: KanbanSquare, title: "Suivre tes candidatures", text: "Kanban, relances recommandées, historique de chaque échange." },
  { icon: Bell, title: "Recevoir tes alertes", text: "Nouvelle offre très compatible, relance à faire, entretien qui approche." },
  { icon: FileText, title: "Sauvegarder ton CV", text: "Plusieurs versions, analysées et adaptées à chaque offre." },
  { icon: Bookmark, title: "Conserver tes favoris", text: "Offres et entreprises retrouvées sur tous tes appareils." },
];

/**
 * /dashboard sans compte : explication de l'espace personnel, jamais une redirection brutale.
 * Le visiteur peut créer son espace ou continuer sans compte.
 */
export function GuestDashboard() {
  return (
    <PageContainer className="space-y-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden /> Réservé aux comptes, gratuit
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Ton espace personnel</h1>
        <p className="mt-3 text-muted-foreground">
          La recherche, les offres, les entreprises, le Radar et la carte restent utilisables sans compte. L'espace personnel ajoute ce qui doit te suivre d'un jour et d'un appareil à l'autre.
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
      <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        {BENEFITS.map((b) => (
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
    </PageContainer>
  );
}

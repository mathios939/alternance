import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/jobs/components/search-bar";

export function Hero({ stats }: { stats: { jobs: number; companies: number; cities: number } }) {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[560px]" aria-hidden />
      <div className="pointer-events-none absolute top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-24">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs animate-fade-in">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          Le système d'exploitation de ta recherche d'alternance
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl animate-fade-up">
          Trouve ton alternance <span className="text-gradient">avant les autres.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty animate-fade-up [animation-delay:80ms]">
          Toutes les offres, les entreprises à contacter et les outils nécessaires pour décrocher ton alternance, réunis au même endroit.
        </p>
        <div className="mx-auto mt-10 max-w-3xl animate-fade-up [animation-delay:160ms]">
          <SearchBar />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 animate-fade-up [animation-delay:240ms]">
          <Button asChild variant="outline" size="lg">
            <Link href="/companies">
              <Building2 aria-hidden /> Explorer les entreprises
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/register">
              Créer mon assistant <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats.jobs.toLocaleString("fr-FR")}</strong> offres indexées
          </span>
          <span>
            <strong className="text-foreground">{stats.companies.toLocaleString("fr-FR")}</strong> entreprises
          </span>
          <span>
            <strong className="text-foreground">{stats.cities}</strong> villes
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-success" aria-hidden /> Gratuit · RGPD · sans revente de données
          </span>
        </div>
      </div>
    </section>
  );
}

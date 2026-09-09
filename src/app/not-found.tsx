import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="max-w-sm text-muted-foreground">Cette page n'existe pas ou a été déplacée. L'offre a peut-être expiré.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/jobs">Voir les offres</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { PRIORITY_CITIES } from "@/config/cities";
import { siteConfig } from "@/config/site";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Offres d'alternance", href: "/jobs" },
      { label: "Entreprises", href: "/companies" },
      { label: "Opportunity Radar", href: "/radar" },
      { label: "Carte", href: "/map" },
      { label: "D'où viennent les données", href: "/sources" },
      { label: "Fonctionnalités", href: "/#fonctionnalites" },
      { label: "Tarifs", href: "/tarifs" },
    ],
  },
  {
    title: "Villes",
    links: PRIORITY_CITIES.slice(0, 8).map((c) => ({ label: `Alternance ${c.name}`, href: `/alternance/${c.slug}` })),
  },
  {
    title: "Légal",
    links: [
      { label: "Confidentialité & RGPD", href: "/confidentialite" },
      { label: "Conditions d'utilisation", href: "/cgu" },
      { label: "Mentions légales", href: "/mentions-legales" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{siteConfig.description}</p>
            {siteConfig.isDemoMode ? (
              <p className="max-w-xs rounded-lg border border-dashed bg-warning-soft/50 px-3 py-2 text-xs text-muted-foreground">
                Version de démonstration : les offres, entreprises et contacts affichés sont fictifs.
              </p>
            ) : null}
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-sm font-semibold">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.name}. Tes données ne sont jamais vendues.</p>
          <p>Fait avec soin pour les étudiants de l'Ouest, et de toute la France.</p>
        </div>
      </div>
    </footer>
  );
}

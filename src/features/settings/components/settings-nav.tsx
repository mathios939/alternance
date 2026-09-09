"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Compte" },
  { href: "/settings/profile", label: "Profil candidat" },
  { href: "/settings/alerts", label: "Alertes" },
  { href: "/settings/privacy", label: "Confidentialité & données" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des paramètres" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={pathname === i.href ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", pathname === i.href && "bg-card text-foreground shadow-sm")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

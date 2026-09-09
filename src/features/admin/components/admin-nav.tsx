"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/jobs", label: "Offres" },
  { href: "/admin/companies", label: "Entreprises" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/reports", label: "Signalements" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/data", label: "Qualité des données" },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={pathname === i.href ? "page" : undefined} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", pathname === i.href && "bg-card text-foreground shadow-sm")}>
          {i.label}
          {i.href === "/admin/reports" && openReports > 0 ? <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">{openReports}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

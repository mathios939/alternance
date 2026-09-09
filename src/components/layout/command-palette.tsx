"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Search, Sparkles, Zap } from "lucide-react";
import { ADMIN_NAV, FOOTER_NAV, MAIN_NAV, SECONDARY_NAV } from "@/config/nav";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";

export function CommandPalette({ open, onOpenChange, isAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; isAdmin: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  const q = query.trim();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Rechercher une offre, une entreprise, une page…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Aucun résultat. Essaie « développeur Nantes » ou une page.</CommandEmpty>
        {q ? (
          <CommandGroup heading="Rechercher">
            <CommandItem value={`offres ${q}`} onSelect={() => go(`/jobs?q=${encodeURIComponent(q)}`)}>
              <Briefcase /> Offres : « {q} »
            </CommandItem>
            <CommandItem value={`entreprises ${q}`} onSelect={() => go(`/companies?q=${encodeURIComponent(q)}`)}>
              <Building2 /> Entreprises : « {q} »
            </CommandItem>
            <CommandItem value={`copilote ${q}`} onSelect={() => go(`/copilot?q=${encodeURIComponent(q)}`)}>
              <Sparkles /> Demander au copilote : « {q} »
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Actions rapides">
          <CommandItem onSelect={() => go("/jobs?sort=match")}>
            <Sparkles /> Mes meilleures offres du jour
          </CommandItem>
          <CommandItem onSelect={() => go("/applications")}>
            <Search /> Candidatures à relancer
          </CommandItem>
          <CommandItem onSelect={() => go("/urgence")}>
            <Zap /> Activer le mode urgence
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {[...MAIN_NAV, ...SECONDARY_NAV, ...FOOTER_NAV, ...(isAdmin ? [ADMIN_NAV] : [])].map((item) => (
            <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
              {item.shortcut ? <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

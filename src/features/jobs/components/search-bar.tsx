"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEARCH_EXAMPLES } from "@/config/taxonomy";
import { searchCities, type City } from "@/config/cities";
import { Button } from "@/components/ui/button";

type Props = { size?: "lg" | "md"; initialQuery?: string; initialCity?: string; className?: string; autoFocus?: boolean };

/** Barre de recherche principale : métier / compétence / formation + ville ou région. */
export function SearchBar({ size = "lg", initialQuery = "", initialCity = "", className, autoFocus }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const cityRef = useRef<HTMLInputElement>(null);
  const listId = "city-suggestions";

  useEffect(() => {
    setSuggestions(searchCities(city));
  }, [city]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());
    router.push(`/jobs${params.size ? `?${params}` : ""}`);
  }

  function choose(c: City) {
    setCity(c.name);
    setOpen(false);
    setActive(-1);
  }

  const big = size === "lg";
  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={submit} role="search" aria-label="Rechercher une alternance" className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-black/5 sm:flex-row sm:items-center", big ? "sm:p-2.5" : "")}>
        <label className="relative flex flex-1 items-center">
          <span className="sr-only">Métier, compétence ou formation</span>
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Métier, compétence ou formation" autoFocus={autoFocus} className={cn("w-full rounded-xl bg-transparent pr-3 pl-10 outline-none placeholder:text-muted-foreground focus:bg-accent/60", big ? "h-12 text-base" : "h-10 text-sm")} autoComplete="off" />
        </label>
        <div className="hidden h-8 w-px bg-border sm:block" aria-hidden />
        <div className="relative flex-1">
          <label className="relative flex items-center">
            <span className="sr-only">Ville ou région</span>
            <MapPin className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
            <input
              ref={cityRef}
              value={city}
              onChange={(e) => { setCity(e.target.value); setOpen(true); setActive(-1); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={(e) => {
                if (!open) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
                if (e.key === "Enter" && active >= 0 && suggestions[active]) { e.preventDefault(); choose(suggestions[active]); }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Ville ou région"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className={cn("w-full rounded-xl bg-transparent pr-3 pl-10 outline-none placeholder:text-muted-foreground focus:bg-accent/60", big ? "h-12 text-base" : "h-10 text-sm")}
              autoComplete="off"
            />
          </label>
          {open && suggestions.length > 0 ? (
            <ul id={listId} role="listbox" className="absolute top-full left-0 z-30 mt-2 w-full overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
              {suggestions.map((c, i) => (
                <li key={c.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={() => choose(c)} className={cn("flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm", i === active ? "bg-accent" : "hover:bg-accent")}>
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.department}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Button type="submit" size={big ? "lg" : "default"} className="sm:shrink-0">
          Trouver mon alternance <ArrowRight aria-hidden />
        </Button>
      </form>
      {big ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden /> Exemples :
          {SEARCH_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setQ(ex)} className="rounded-full border bg-card px-2.5 py-1 transition-colors hover:border-primary hover:text-primary">
              {ex}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

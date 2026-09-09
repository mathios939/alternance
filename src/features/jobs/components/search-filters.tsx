"use client";

import { useTransition } from "react";
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ContractType, EducationLevel, RemotePolicy } from "@/generated/prisma/enums";
import { CONTRACT_TYPES, DURATIONS, EDUCATION_LEVELS, EDUCATION_LEVEL_KEYS, JOB_FAMILIES, JOB_FAMILY_KEYS, PUBLISHED_WITHIN_OPTIONS, RADIUS_OPTIONS, REMOTE_POLICIES, SECTORS, SECTOR_KEYS, type PublishedWithin } from "@/config/taxonomy";
import { REGIONS } from "@/config/cities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export const jobQueryParsers = {
  q: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  region: parseAsString.withDefault(""),
  radius: parseAsInteger,
  remote: parseAsArrayOf(parseAsStringEnum(Object.values(RemotePolicy))).withDefault([]),
  levels: parseAsArrayOf(parseAsStringEnum(Object.values(EducationLevel))).withDefault([]),
  contracts: parseAsArrayOf(parseAsStringEnum(Object.values(ContractType))).withDefault([]),
  durations: parseAsArrayOf(parseAsInteger).withDefault([]),
  published: parseAsStringEnum(PUBLISHED_WITHIN_OPTIONS.map((o) => o.value) as PublishedWithin[]),
  sectors: parseAsArrayOf(parseAsString).withDefault([]),
  families: parseAsArrayOf(parseAsString).withDefault([]),
  minMatch: parseAsInteger,
  sort: parseAsStringEnum(["relevance", "recent", "match", "distance"]).withDefault("relevance"),
  page: parseAsInteger.withDefault(1),
};

export function useJobFilters() {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(jobQueryParsers, { shallow: false, startTransition, history: "push" });
  return { filters, setFilters, pending };
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b py-4 last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold">
        {title}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function CheckList<T extends string>({ options, value, onChange, name }: { options: Array<{ value: T; label: string }>; value: T[]; onChange: (v: T[]) => void; name: string }) {
  return (
    <ul className="space-y-2">
      {options.map((o) => {
        const id = `${name}-${o.value}`;
        const checked = value.includes(o.value);
        return (
          <li key={o.value} className="flex items-center gap-2.5">
            <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true ? [...value, o.value] : value.filter((x) => x !== o.value))} />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
              {o.label}
            </Label>
          </li>
        );
      })}
    </ul>
  );
}

export function SearchFiltersPanel({ hasProfile }: { hasProfile: boolean }) {
  const { filters, setFilters } = useJobFilters();
  const reset = () => setFilters({ city: null, region: null, radius: null, remote: null, levels: null, contracts: null, durations: null, published: null, sectors: null, families: null, minMatch: null, page: null });
  type Patch = Partial<{ [K in keyof typeof filters]: (typeof filters)[K] | null }>;
  const patch = (p: Patch) => setFilters({ ...p, page: null });

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between pb-2">
        <p className="inline-flex items-center gap-2 font-semibold">
          <SlidersHorizontal className="size-4" aria-hidden /> Filtres
        </p>
        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
          <RotateCcw /> Réinitialiser
        </Button>
      </div>
      <Section title="Localisation">
        <div className="space-y-3">
          <CityAutocomplete value={filters.city} onChange={(v) => patch({ city: v || null, region: null })} placeholder="Ville" />
          <Select value={filters.region || "all"} onValueChange={(v) => patch({ region: v === "all" ? null : v, city: null })}>
            <SelectTrigger aria-label="Région">
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les régions</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Rayon autour de la ville</p>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_OPTIONS.map((r) => (
                <button key={r} type="button" disabled={!filters.city} onClick={() => patch({ radius: filters.radius === r ? null : r })} aria-pressed={filters.radius === r} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary disabled:opacity-40", filters.radius === r && "border-primary bg-primary-soft text-primary")}>
                  {r} km
                </button>
              ))}
            </div>
          </div>
          <CheckList name="remote" options={(Object.keys(REMOTE_POLICIES) as RemotePolicy[]).map((k) => ({ value: k, label: REMOTE_POLICIES[k].label }))} value={filters.remote} onChange={(v) => patch({ remote: v.length ? v : null })} />
        </div>
      </Section>
      <Section title="Publication">
        <div className="flex flex-wrap gap-1.5">
          {PUBLISHED_WITHIN_OPTIONS.map((o) => (
            <button key={o.value} type="button" onClick={() => patch({ published: filters.published === o.value ? null : o.value })} aria-pressed={filters.published === o.value} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", filters.published === o.value && "border-primary bg-primary-soft text-primary")}>
              {o.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Niveau d'études">
        <CheckList name="levels" options={EDUCATION_LEVEL_KEYS.map((k) => ({ value: k, label: EDUCATION_LEVELS[k].label }))} value={filters.levels} onChange={(v) => patch({ levels: v.length ? v : null })} />
      </Section>
      <Section title="Contrat & durée" defaultOpen={false}>
        <CheckList name="contracts" options={(Object.keys(CONTRACT_TYPES) as ContractType[]).map((k) => ({ value: k, label: CONTRACT_TYPES[k].label }))} value={filters.contracts} onChange={(v) => patch({ contracts: v.length ? v : null })} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => {
            const on = filters.durations.includes(d);
            return (
              <button key={d} type="button" onClick={() => patch({ durations: on ? (filters.durations.filter((x) => x !== d).length ? filters.durations.filter((x) => x !== d) : null) : [...filters.durations, d] })} aria-pressed={on} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")}>
                {d} mois
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Métiers" defaultOpen={false}>
        <CheckList name="families" options={JOB_FAMILY_KEYS.map((k) => ({ value: k, label: JOB_FAMILIES[k].label }))} value={filters.families} onChange={(v) => patch({ families: v.length ? v : null })} />
      </Section>
      <Section title="Secteurs" defaultOpen={false}>
        <CheckList name="sectors" options={SECTOR_KEYS.map((k) => ({ value: k, label: `${SECTORS[k].emoji} ${SECTORS[k].label}` }))} value={filters.sectors} onChange={(v) => patch({ sectors: v.length ? v : null })} />
      </Section>
      {hasProfile ? (
        <Section title="Compatibilité minimale" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {[50, 70, 85].map((m) => (
              <button key={m} type="button" onClick={() => patch({ minMatch: filters.minMatch === m ? null : m })} aria-pressed={filters.minMatch === m} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", filters.minMatch === m && "border-primary bg-primary-soft text-primary")}>
                ≥ {m} %
              </button>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

export function MobileFiltersSheet({ hasProfile, activeCount }: { hasProfile: boolean; activeCount: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal /> Filtres {activeCount > 0 ? <Badge variant="soft" className="ml-1 px-1.5">{activeCount}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtres</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <SearchFiltersPanel hasProfile={hasProfile} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useTransition } from "react";
import { parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { RotateCcw, Search } from "lucide-react";
import { CompanySize } from "@/generated/prisma/enums";
import { COMPANY_SIZES, RADIUS_OPTIONS, SECTORS, SECTOR_KEYS } from "@/config/taxonomy";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import { Badge } from "@/components/ui/badge";

export const companyQueryParsers = {
  q: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  radius: parseAsInteger,
  sectors: parseAsArrayOf(parseAsString).withDefault([]),
  sizes: parseAsArrayOf(parseAsStringEnum(Object.values(CompanySize))).withDefault([]),
  hiresApprentices: parseAsBoolean.withDefault(false),
  hiring: parseAsBoolean.withDefault(false),
  sort: parseAsStringEnum(["relevance", "opportunity", "distance", "name", "jobs"]).withDefault("relevance"),
  page: parseAsInteger.withDefault(1),
};

export function CompanyFilters({ hasProfile, total }: { hasProfile: boolean; total: number }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useQueryStates(companyQueryParsers, { shallow: false, startTransition, history: "push" });
  type Patch = Partial<{ [K in keyof typeof f]: (typeof f)[K] | null }>;
  const patch = (p: Patch) => setF({ ...p, page: null });

  return (
    <div className="surface space-y-4 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          patch({ q: String(fd.get("q") ?? "") || null });
        }}
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={f.q} placeholder="Trouve une entreprise à contacter (nom, techno, secteur)" className="pl-9" aria-label="Rechercher une entreprise" />
        </div>
        <CityAutocomplete value={f.city} onChange={(v) => patch({ city: v || null })} placeholder="Ville" className="sm:w-56" />
        <Button type="submit" loading={pending}>Rechercher</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Rayon :</span>
        {RADIUS_OPTIONS.map((r) => (
          <button key={r} type="button" disabled={!f.city} onClick={() => patch({ radius: f.radius === r ? null : r })} aria-pressed={f.radius === r} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary disabled:opacity-40", f.radius === r && "border-primary bg-primary-soft text-primary")}>
            {r} km
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
        <span className="text-xs text-muted-foreground">Taille :</span>
        {(Object.keys(COMPANY_SIZES) as CompanySize[]).map((s) => {
          const on = f.sizes.includes(s);
          return (
            <button key={s} type="button" onClick={() => patch({ sizes: on ? (f.sizes.filter((x) => x !== s).length ? f.sizes.filter((x) => x !== s) : null) : [...f.sizes, s] })} aria-pressed={on} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")} title={COMPANY_SIZES[s].range}>
              {COMPANY_SIZES[s].label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Select value={f.sectors[0] ?? "all"} onValueChange={(v) => patch({ sectors: v === "all" ? null : [v] })}>
          <SelectTrigger size="sm" className="w-64" aria-label="Secteur">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            {SECTOR_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SECTORS[k].emoji} {SECTORS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.hiresApprentices} onCheckedChange={(v) => patch({ hiresApprentices: v || null })} aria-label="Accueille des alternants" />
          <Label className="font-normal">Accueille des alternants</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.hiring} onCheckedChange={(v) => patch({ hiring: v || null })} aria-label="Recrute actuellement" />
          <Label className="font-normal">Recrute actuellement</Label>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Select value={f.sort} onValueChange={(v) => patch({ sort: v as typeof f.sort })}>
            <SelectTrigger size="sm" className="w-44" aria-label="Trier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Pertinence</SelectItem>
              {hasProfile ? <SelectItem value="opportunity">Potentiel</SelectItem> : null}
              <SelectItem value="jobs">Nombre d'offres</SelectItem>
              {hasProfile || f.city ? <SelectItem value="distance">Distance</SelectItem> : null}
              <SelectItem value="name">Nom</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setF({ q: null, city: null, radius: null, sectors: null, sizes: null, hiresApprentices: null, hiring: null, sort: null, page: null })} className="text-muted-foreground">
            <RotateCcw /> Réinitialiser
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        <Badge variant="muted" className="mr-1">{total}</Badge> entreprise{total > 1 ? "s" : ""}
      </p>
    </div>
  );
}

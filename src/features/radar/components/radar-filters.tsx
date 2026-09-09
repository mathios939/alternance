"use client";

import { useTransition } from "react";
import { parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { CompanySize } from "@/generated/prisma/enums";
import { COMPANY_SIZES, RADIUS_OPTIONS, SECTORS, SECTOR_KEYS } from "@/config/taxonomy";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export const radarParsers = {
  radius: parseAsInteger,
  sectors: parseAsArrayOf(parseAsString).withDefault([]),
  sizes: parseAsArrayOf(parseAsStringEnum(Object.values(CompanySize))).withDefault([]),
  withoutJobs: parseAsBoolean.withDefault(false),
};

export function RadarFilters({ defaultRadius }: { defaultRadius: number }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useQueryStates(radarParsers, { shallow: false, startTransition });
  const radius = f.radius ?? defaultRadius;
  return (
    <div className="surface flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Rayon :</span>
        {RADIUS_OPTIONS.map((r) => (
          <button key={r} type="button" onClick={() => setF({ radius: r === defaultRadius ? null : r })} aria-pressed={radius === r} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", radius === r && "border-primary bg-primary-soft text-primary")}>
            {r} km
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Taille :</span>
        {(Object.keys(COMPANY_SIZES) as CompanySize[]).map((s) => {
          const on = f.sizes.includes(s);
          return (
            <button key={s} type="button" onClick={() => setF({ sizes: on ? (f.sizes.filter((x) => x !== s).length ? f.sizes.filter((x) => x !== s) : null) : [...f.sizes, s] })} aria-pressed={on} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary", on && "border-primary bg-primary-soft text-primary")}>
              {COMPANY_SIZES[s].label}
            </button>
          );
        })}
      </div>
      <Select value={f.sectors[0] ?? "all"} onValueChange={(v) => setF({ sectors: v === "all" ? null : [v] })}>
        <SelectTrigger size="sm" className="w-60" aria-label="Secteur">
          <SelectValue placeholder="Secteur" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les secteurs</SelectItem>
          {SECTOR_KEYS.map((k) => (
            <SelectItem key={k} value={k}>{SECTORS[k].emoji} {SECTORS[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={f.withoutJobs} onCheckedChange={(v) => setF({ withoutJobs: v || null })} aria-label="Uniquement sans offre publiée" />
        <Label className="font-normal">Uniquement sans offre publiée</Label>
      </label>
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Chargement" /> : null}
    </div>
  );
}

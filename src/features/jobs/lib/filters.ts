import { z } from "zod";
import { PUBLISHED_WITHIN_OPTIONS, RADIUS_OPTIONS, type PublishedWithin } from "@/config/taxonomy";
import { ContractType, EducationLevel, RemotePolicy } from "@/generated/prisma/enums";

const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.array(z.enum(values as unknown as [T, ...T[]])), z.string()])
    .optional()
    .transform((v) => {
      if (!v) return [] as T[];
      const arr = Array.isArray(v) ? v : v.split(",");
      return arr.filter((x): x is T => (values as readonly string[]).includes(x));
    });

export const jobFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  department: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  radius: z.coerce.number().optional().transform((v) => (v && (RADIUS_OPTIONS as readonly number[]).includes(v) ? v : undefined)),
  remote: csv(Object.values(RemotePolicy)),
  levels: csv(Object.values(EducationLevel)),
  contracts: csv(Object.values(ContractType)),
  durations: z
    .union([z.array(z.coerce.number()), z.string()])
    .optional()
    .transform((v) => {
      if (!v) return [] as number[];
      const arr = Array.isArray(v) ? v : v.split(",").map(Number);
      return arr.filter((n) => [6, 12, 24, 36].includes(n));
    }),
  published: z
    .string()
    .optional()
    .transform((v) => (PUBLISHED_WITHIN_OPTIONS.some((o) => o.value === v) ? (v as PublishedWithin) : undefined)),
  sectors: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (!v ? [] : Array.isArray(v) ? v : v.split(",")).filter(Boolean)),
  families: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (!v ? [] : Array.isArray(v) ? v : v.split(",")).filter(Boolean)),
  minMatch: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(["relevance", "recent", "match", "distance"]).optional().default("relevance"),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type JobFilters = z.infer<typeof jobFiltersSchema>;
export type JobFiltersInput = z.input<typeof jobFiltersSchema>;

export const DEFAULT_FILTERS: JobFilters = jobFiltersSchema.parse({});

export function publishedWithinToDate(value: PublishedWithin | undefined, now = new Date()): Date | undefined {
  const option = PUBLISHED_WITHIN_OPTIONS.find((o) => o.value === value);
  return option ? new Date(now.getTime() - option.hours * 3_600_000) : undefined;
}

export function countActiveFilters(f: JobFilters): number {
  let n = 0;
  if (f.city || f.department || f.region) n++;
  if (f.radius) n++;
  if (f.remote.length) n++;
  if (f.levels.length) n++;
  if (f.contracts.length) n++;
  if (f.durations.length) n++;
  if (f.published) n++;
  if (f.sectors.length) n++;
  if (f.families.length) n++;
  if (f.minMatch) n++;
  return n;
}

/** Sérialise les filtres en query string (valeurs vides omises). */
export function filtersToSearchParams(f: Partial<JobFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.city) p.set("city", f.city);
  if (f.department) p.set("department", f.department);
  if (f.region) p.set("region", f.region);
  if (f.radius) p.set("radius", String(f.radius));
  if (f.remote?.length) p.set("remote", f.remote.join(","));
  if (f.levels?.length) p.set("levels", f.levels.join(","));
  if (f.contracts?.length) p.set("contracts", f.contracts.join(","));
  if (f.durations?.length) p.set("durations", f.durations.join(","));
  if (f.published) p.set("published", f.published);
  if (f.sectors?.length) p.set("sectors", f.sectors.join(","));
  if (f.families?.length) p.set("families", f.families.join(","));
  if (f.minMatch) p.set("minMatch", String(f.minMatch));
  if (f.sort && f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

/** Prédicat en mémoire (utilisé pour les tests et les petites listes). */
export function matchesFilters(
  job: {
    title: string;
    description: string;
    city: string;
    department: string | null;
    region: string | null;
    remote: RemotePolicy;
    contractType: ContractType;
    educationLevelMin: EducationLevel | null;
    educationLevelMax: EducationLevel | null;
    durationMonths: number | null;
    publishedAt: Date;
    sector: string;
    jobFamily: string;
    skillsText: string[];
  },
  f: JobFilters,
  now = new Date(),
): boolean {
  if (f.q) {
    const hay = `${job.title} ${job.description} ${job.skillsText.join(" ")}`.toLowerCase();
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  if (f.city && job.city.toLowerCase() !== f.city.toLowerCase() && !f.radius) return false;
  if (f.department && job.department?.toLowerCase() !== f.department.toLowerCase()) return false;
  if (f.region && job.region?.toLowerCase() !== f.region.toLowerCase()) return false;
  if (f.remote.length && !f.remote.includes(job.remote)) return false;
  if (f.contracts.length && !f.contracts.includes(job.contractType)) return false;
  if (f.durations.length && (job.durationMonths === null || !f.durations.includes(job.durationMonths))) return false;
  if (f.sectors.length && !f.sectors.includes(job.sector)) return false;
  if (f.families.length && !f.families.includes(job.jobFamily)) return false;
  if (f.levels.length) {
    const order = Object.values(EducationLevel);
    const min = job.educationLevelMin ? order.indexOf(job.educationLevelMin) : 0;
    const max = job.educationLevelMax ? order.indexOf(job.educationLevelMax) : order.length - 1;
    const ok = f.levels.some((l) => {
      const i = order.indexOf(l);
      return i >= min && i <= max;
    });
    if (!ok) return false;
  }
  const since = publishedWithinToDate(f.published, now);
  if (since && job.publishedAt < since) return false;
  return true;
}

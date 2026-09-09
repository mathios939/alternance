import "server-only";
import { cache } from "react";
import { z } from "zod";
import { findCity } from "@/config/cities";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CompanySize } from "@/generated/prisma/enums";
import { boundingBox, haversineKm } from "@/lib/geo";
import { calculateOpportunityScore, type CandidateForMatching, type CompanyForMatching, type OpportunityResult } from "@/lib/matching";
import { getSearchProvider } from "@/lib/search";
import type { CompanyCardData } from "@/features/companies/types";

const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (!v ? [] : Array.isArray(v) ? v : v.split(",")).filter((x): x is T => (values as readonly string[]).includes(x)));

export const companyFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  radius: z.coerce.number().optional().transform((v) => (v && [5, 10, 20, 30, 50, 100].includes(v) ? v : undefined)),
  sectors: z.union([z.array(z.string()), z.string()]).optional().transform((v) => (!v ? [] : Array.isArray(v) ? v : v.split(",")).filter(Boolean)),
  sizes: csv(Object.values(CompanySize)),
  hiresApprentices: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional().transform(Boolean),
  hiring: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional().transform(Boolean),
  sort: z.enum(["relevance", "opportunity", "distance", "name", "jobs"]).optional().default("relevance"),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

const PAGE_SIZE = 18;

export const companyCardInclude = {
  _count: { select: { jobs: { where: { isActive: true, canonicalJobId: null } }, contacts: { where: { optOutAt: null } } } },
} satisfies Prisma.CompanyInclude;

type CompanyWithCounts = Prisma.CompanyGetPayload<{ include: typeof companyCardInclude }>;

export function toCompanyForMatching(c: CompanyWithCounts): CompanyForMatching {
  return {
    id: c.id,
    sector: c.sector,
    size: c.size,
    jobFamilies: c.jobFamilies,
    technologies: c.technologies,
    latitude: c.latitude,
    longitude: c.longitude,
    city: c.city,
    department: c.department,
    region: c.region,
    hiresApprentices: c.hiresApprentices,
    apprenticeCountEstimate: c.apprenticeCountEstimate,
    isHiring: c.isHiring,
    activeJobsCount: c._count.jobs,
    lastActivityAt: c.lastActivityAt,
  };
}

type Ctx = { userId?: string; candidate?: CandidateForMatching | null };

async function loadEnrichment(userId: string | undefined, ids: string[]) {
  if (!userId || ids.length === 0) return { favorites: new Set<string>(), applications: new Set<string>() };
  const [favorites, applications] = await Promise.all([
    prisma.favorite.findMany({ where: { userId, companyId: { in: ids } }, select: { companyId: true } }),
    prisma.application.findMany({ where: { userId, companyId: { in: ids }, archivedAt: null }, select: { companyId: true } }),
  ]);
  return { favorites: new Set(favorites.map((f) => f.companyId!)), applications: new Set(applications.map((a) => a.companyId)) };
}

export function toCompanyCard(c: CompanyWithCounts, ctx: Ctx, enrichment?: { favorites: Set<string>; applications: Set<string> }, precomputed?: { opportunity: OpportunityResult | null; distanceKm: number | null }): CompanyCardData {
  let opportunity = precomputed?.opportunity ?? null;
  let distanceKm = precomputed?.distanceKm ?? null;
  if (!precomputed && ctx.candidate) {
    opportunity = calculateOpportunityScore(ctx.candidate, toCompanyForMatching(c));
    distanceKm = opportunity.distanceKm;
  }
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    sector: c.sector,
    size: c.size,
    headcount: c.headcount,
    city: c.city,
    department: c.department,
    region: c.region,
    logoUrl: c.logoUrl,
    technologies: c.technologies,
    jobFamilies: c.jobFamilies,
    hiresApprentices: c.hiresApprentices,
    apprenticeCountEstimate: c.apprenticeCountEstimate,
    isHiring: c.isHiring,
    activeJobsCount: c._count.jobs,
    contactsCount: c._count.contacts,
    isDemo: c.isDemo,
    dataOrigin: c.dataOrigin,
    opportunity,
    distanceKm,
    isFavorite: enrichment?.favorites.has(c.id) ?? false,
    hasApplication: enrichment?.applications.has(c.id) ?? false,
  };
}

export async function searchCompanies(filters: CompanyFilters, ctx: Ctx = {}) {
  const where: Prisma.CompanyWhereInput = {};
  const and: Prisma.CompanyWhereInput[] = [];
  let center: { lat: number; lng: number; radius: number } | null = null;
  const city = filters.city ? findCity(filters.city) : undefined;
  if (filters.city) {
    if (city && filters.radius) {
      center = { lat: city.lat, lng: city.lng, radius: filters.radius };
      const box = boundingBox(center, filters.radius);
      and.push({ OR: [{ latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } }, { locations: { some: { city: { equals: city.name, mode: "insensitive" } } } }] });
    } else {
      and.push({ OR: [{ city: { equals: city?.name ?? filters.city, mode: "insensitive" } }, { locations: { some: { city: { equals: city?.name ?? filters.city, mode: "insensitive" } } } }] });
    }
  }
  if (filters.region) and.push({ region: { equals: filters.region, mode: "insensitive" } });
  if (filters.sectors.length) and.push({ sector: { in: filters.sectors } });
  if (filters.sizes.length) and.push({ size: { in: filters.sizes } });
  if (filters.hiresApprentices) and.push({ hiresApprentices: true });
  if (filters.hiring) and.push({ OR: [{ isHiring: true }, { jobs: { some: { isActive: true } } }] });
  let ranks: Map<string, number> | null = null;
  if (filters.q) {
    const hits = await getSearchProvider().searchCompanies(filters.q, { limit: 300 });
    ranks = new Map(hits.map((h) => [h.id, h.rank]));
    if (ranks.size === 0) return { items: [] as CompanyCardData[], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
    and.push({ id: { in: [...ranks.keys()] } });
  }
  if (and.length) where.AND = and;

  const companies = await prisma.company.findMany({ where, include: companyCardInclude, orderBy: { name: "asc" }, take: 500 });
  const inRadius = center ? companies.filter((c) => c.latitude === null || c.longitude === null || haversineKm(center, { lat: c.latitude, lng: c.longitude }) <= center.radius) : companies;
  const enrichment = await loadEnrichment(ctx.userId, inRadius.map((c) => c.id));
  const scored = inRadius.map((c) => {
    const opportunity = ctx.candidate ? calculateOpportunityScore(ctx.candidate, toCompanyForMatching(c)) : null;
    const distanceKm = opportunity?.distanceKm ?? (center && c.latitude !== null && c.longitude !== null ? haversineKm(center, { lat: c.latitude, lng: c.longitude }) : null);
    return { c, opportunity, distanceKm, rank: ranks?.get(c.id) ?? 0 };
  });
  scored.sort((a, b) => {
    if (filters.sort === "name") return a.c.name.localeCompare(b.c.name, "fr");
    if (filters.sort === "jobs") return b.c._count.jobs - a.c._count.jobs;
    if (filters.sort === "distance") return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    if (filters.sort === "opportunity") return (b.opportunity?.score ?? 0) - (a.opportunity?.score ?? 0);
    if (ranks && Math.abs(b.rank - a.rank) > 0.2) return b.rank - a.rank;
    if (a.opportunity && b.opportunity) return b.opportunity.score - a.opportunity.score;
    return b.c._count.jobs - a.c._count.jobs || a.c.name.localeCompare(b.c.name, "fr");
  });
  const total = scored.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const items = scored.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => toCompanyCard(s.c, ctx, enrichment, { opportunity: s.opportunity, distanceKm: s.distanceKm }));
  return { items, total, page, pageSize: PAGE_SIZE, totalPages };
}

export const getCompanyBySlug = cache(async (slug: string) => {
  return prisma.company.findUnique({
    where: { slug },
    include: {
      ...companyCardInclude,
      locations: true,
      contacts: { where: { optOutAt: null }, orderBy: { confidenceScore: "desc" } },
      jobs: { where: { isActive: true, canonicalJobId: null }, orderBy: { publishedAt: "desc" }, include: { skills: { include: { skill: { select: { slug: true, name: true } } } }, company: { select: { id: true, slug: true, name: true, logoUrl: true, size: true, sector: true, city: true } } } },
    },
  });
});

export type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompanyBySlug>>>;

export async function getSimilarCompanies(company: { id: string; sector: string; region: string | null; jobFamilies: string[] }, ctx: Ctx, limit = 4): Promise<CompanyCardData[]> {
  const companies = await prisma.company.findMany({
    where: { id: { not: company.id }, OR: [{ sector: company.sector }, { jobFamilies: { hasSome: company.jobFamilies } }] },
    include: companyCardInclude,
    take: 30,
  });
  const enrichment = await loadEnrichment(ctx.userId, companies.map((c) => c.id));
  return companies
    .map((c) => ({ c, score: (c.sector === company.sector ? 2 : 0) + (c.region === company.region ? 2 : 0) + c.jobFamilies.filter((f) => company.jobFamilies.includes(f)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => toCompanyCard(s.c, ctx, enrichment));
}

/**
 * Radar : entreprises pertinentes pour le candidat, avec ou sans offre active.
 * Classement par OpportunityScore (estimation).
 */
export async function getRadar(ctx: { userId: string; candidate: CandidateForMatching }, options?: { limit?: number; radiusKm?: number; onlyWithoutJobs?: boolean; sectors?: string[]; sizes?: CompanySize[] }) {
  const c = ctx.candidate;
  const radius = options?.radiusKm ?? c.maxRadiusKm;
  const where: Prisma.CompanyWhereInput = {};
  const and: Prisma.CompanyWhereInput[] = [];
  if (c.latitude !== null && c.longitude !== null && c.mobility !== "NATIONAL") {
    const box = boundingBox({ lat: c.latitude, lng: c.longitude }, radius);
    and.push({ OR: [{ latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } }, { locations: { some: { latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } } } }] });
  } else if (c.region && c.mobility === "REGION") {
    and.push({ region: c.region });
  }
  if (options?.sectors?.length) and.push({ sector: { in: options.sectors } });
  if (options?.sizes?.length) and.push({ size: { in: options.sizes } });
  if (options?.onlyWithoutJobs) and.push({ jobs: { none: { isActive: true } } });
  if (and.length) where.AND = and;
  const companies = await prisma.company.findMany({ where, include: { ...companyCardInclude, locations: true }, take: 400 });
  const enrichment = await loadEnrichment(ctx.userId, companies.map((x) => x.id));
  const scored = companies
    .map((company) => {
      // Utilise l'implantation la plus proche du candidat
      let best = toCompanyForMatching(company);
      if (c.latitude !== null && c.longitude !== null) {
        let bestD = best.latitude !== null && best.longitude !== null ? haversineKm({ lat: c.latitude, lng: c.longitude }, { lat: best.latitude, lng: best.longitude }) : Infinity;
        for (const loc of company.locations) {
          if (loc.latitude === null || loc.longitude === null) continue;
          const d = haversineKm({ lat: c.latitude, lng: c.longitude }, { lat: loc.latitude, lng: loc.longitude });
          if (d < bestD) {
            bestD = d;
            best = { ...best, latitude: loc.latitude, longitude: loc.longitude, city: loc.city, department: loc.department, region: loc.region };
          }
        }
      }
      const opportunity = calculateOpportunityScore(c, best);
      return { company, opportunity, nearestCity: best.city };
    })
    .filter((s) => s.opportunity.distanceKm === null || s.opportunity.distanceKm <= radius * 1.2)
    .sort((a, b) => b.opportunity.score - a.opportunity.score);
  const total = scored.length;
  const items = scored.slice(0, options?.limit ?? 50).map((s) => ({ ...toCompanyCard(s.company, ctx, enrichment, { opportunity: s.opportunity, distanceKm: s.opportunity.distanceKm }), nearestCity: s.nearestCity }));
  return { items, total, radius };
}

export const getFeaturedCompanies = cache(async (limit = 6): Promise<CompanyCardData[]> => {
  const companies = await prisma.company.findMany({ where: { hiresApprentices: true }, include: companyCardInclude, orderBy: [{ apprenticeCountEstimate: "desc" }], take: limit });
  return companies.map((c) => toCompanyCard(c, { candidate: null }));
});

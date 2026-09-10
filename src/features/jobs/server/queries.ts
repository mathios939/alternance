import "server-only";
import { cache } from "react";
import { findCity } from "@/config/cities";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { boundingBox, haversineKm } from "@/lib/geo";
import {
  calculateMatchScore,
  calculateOpportunityPriorityScore,
  estimateCompetition,
  type CandidateForMatching,
  type JobForMatching,
  type MatchResult,
} from "@/lib/matching";
import { getSearchProvider } from "@/lib/search";
import { demoFilter } from "@/lib/demo-mode";
import { createLogger } from "@/lib/logger";
import { safeExternalUrl } from "@/lib/external-url";
import { computeFreshness } from "@/lib/freshness";
import { CITIES } from "@/config/cities";
import { type JobFilters, publishedWithinToDate } from "@/features/jobs/lib/filters";
import type { JobCardData, JobDetailData, JobSearchResult } from "@/features/jobs/types";

const log = createLogger("jobs:queries");
const PAGE_SIZE = 20;
const MAX_CANDIDATES = 600;

export const jobCardInclude = {
  company: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      size: true,
      sector: true,
      city: true,
      isPlaceholder: true,
    },
  },
  skills: { include: { skill: { select: { slug: true, name: true } } } },
  _count: { select: { sourceEntries: { where: { status: { in: ["ACTIVE", "UNKNOWN"] } } } } },
} satisfies Prisma.JobInclude;

/** Offres visibles : actives, canoniques, non expirées, et hors démo si DEMO_MODE=false. */
export function visibleJobsWhere(): Prisma.JobWhereInput {
  return {
    isActive: true,
    canonicalJobId: null,
    verificationStatus: { notIn: ["EXPIRED", "REMOVED"] },
    ...demoFilter(),
  };
}

const SOURCE_LABELS: Record<string, string> = {
  FRANCE_TRAVAIL: "France Travail",
  COMPANY_CAREER: "Site carrières de l'entreprise",
  ATS: "Site carrières (ATS)",
  MANUAL: "Base Alternance OS",
  PARTNER: "Partenaire",
  OTHER: "Autre source",
};

/** Rayon par défaut (km) quand une ville est donnée sans rayon : géographique, pas une égalité de chaînes. */
const DEFAULT_CITY_RADIUS_KM = 15;

export type JobWithCard = Prisma.JobGetPayload<{ include: typeof jobCardInclude }>;

export function toJobForMatching(job: JobWithCard): JobForMatching {
  return {
    id: job.id,
    title: job.title,
    jobFamily: job.jobFamily,
    sector: job.sector,
    skills: job.skills.map((s) => s.skill.slug),
    requiredSkills: job.skills.filter((s) => s.required).map((s) => s.skill.slug),
    educationLevelMin: job.educationLevelMin,
    educationLevelMax: job.educationLevelMax,
    latitude: job.latitude,
    longitude: job.longitude,
    city: job.city,
    department: job.department,
    region: job.region,
    remote: job.remote,
    rhythm: job.rhythm,
    durationMonths: job.durationMonths,
    startDate: job.startDate,
    contractType: job.contractType,
    publishedAt: job.publishedAt,
  };
}

type UserContext = {
  userId?: string;
  candidate?: CandidateForMatching | null;
};

type Enrichment = {
  favorites: Map<string, string>;
  applications: Map<string, { id: string; status: JobCardData["applicationStatus"] }>;
};

async function loadEnrichment(userId: string | undefined, jobIds: string[]): Promise<Enrichment> {
  const empty: Enrichment = { favorites: new Map(), applications: new Map() };
  if (!userId || jobIds.length === 0) return empty;
  const [favorites, applications] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId, jobId: { in: jobIds } },
      select: { jobId: true, collection: true },
    }),
    prisma.application.findMany({
      where: { userId, jobId: { in: jobIds }, archivedAt: null },
      select: { id: true, jobId: true, status: true },
    }),
  ]);
  return {
    favorites: new Map(favorites.map((f) => [f.jobId!, f.collection])),
    applications: new Map(applications.map((a) => [a.jobId!, { id: a.id, status: a.status }])),
  };
}

export function toJobCard(
  job: JobWithCard,
  ctx: UserContext,
  enrichment?: Enrichment,
  precomputed?: { match: MatchResult | null; distanceKm: number | null; priority: number | null },
): JobCardData {
  let match: MatchResult | null = precomputed?.match ?? null;
  let distanceKm = precomputed?.distanceKm ?? null;
  let priority = precomputed?.priority ?? null;
  if (!precomputed && ctx.candidate) {
    match = calculateMatchScore(ctx.candidate, toJobForMatching(job));
    distanceKm = match.distanceKm;
    priority = computePriority(
      ctx.candidate,
      job,
      match,
      enrichment?.favorites.has(job.id) ?? false,
    );
  } else if (!precomputed && ctx.candidate === null) {
    distanceKm = null;
  }
  const application = enrichment?.applications.get(job.id);
  const freshness = computeFreshness({
    publishedAt: job.publishedAt,
    discoveredAt: job.discoveredAt,
    lastVerifiedAt: job.lastVerifiedAt,
    sourceUpdatedAt: job.sourceUpdatedAt,
  });
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    city: job.city,
    department: job.department,
    region: job.region,
    publishedAt: job.publishedAt.toISOString(),
    discoveredAt: job.discoveredAt.toISOString(),
    sourceUpdatedAt: job.sourceUpdatedAt?.toISOString() ?? null,
    freshness: freshness.level,
    isNew: !job.isDemo && freshness.isNew,
    contractType: job.contractType,
    educationLevelMin: job.educationLevelMin,
    educationLevelMax: job.educationLevelMax,
    remote: job.remote,
    rhythm: job.rhythm,
    durationMonths: job.durationMonths,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryPeriod: job.salaryPeriod,
    skills: job.skills.map((s) => ({
      slug: s.skill.slug,
      name: s.skill.name,
      required: s.required,
    })),
    jobFamily: job.jobFamily,
    sector: job.sector,
    isDemo: job.isDemo,
    dataOrigin: job.dataOrigin,
    verificationStatus: job.verificationStatus,
    lastVerifiedAt: job.lastVerifiedAt?.toISOString() ?? null,
    sourceLabel: SOURCE_LABELS[job.source] ?? job.source,
    sourceCount: Math.max(1, job._count.sourceEntries),
    company: {
      id: job.company.id,
      slug: job.company.slug,
      name: job.company.name,
      logoUrl: job.company.logoUrl,
      size: job.company.size,
      sector: job.company.sector,
      isPlaceholder: job.company.isPlaceholder,
    },
    applicationUrl: safeExternalUrl(job.applicationUrl),
    match,
    distanceKm,
    priority,
    isFavorite: enrichment?.favorites.has(job.id) ?? false,
    favoriteCollection: enrichment?.favorites.get(job.id) ?? null,
    applicationStatus: application?.status ?? null,
    applicationId: application?.id ?? null,
  };
}

function computePriority(
  candidate: CandidateForMatching,
  job: JobWithCard,
  match: MatchResult,
  isFavorite: boolean,
): number {
  const cityInfo = CITIES.find((c) => c.name === job.city);
  const hours = (Date.now() - job.publishedAt.getTime()) / 3_600_000;
  return calculateOpportunityPriorityScore({
    matchScore: match.total,
    publishedAt: job.publishedAt,
    distanceKm: match.distanceKm,
    maxRadiusKm: candidate.maxRadiusKm,
    competitionEstimate: estimateCompetition({
      companySize: job.company.size,
      cityPopulation: cityInfo?.population,
      hoursSincePublished: hours,
      remote: job.remote,
    }),
    candidateInterest: isFavorite ? 100 : 0,
    companyRelevance: candidate.sectors.includes(job.sector) ? 100 : 40,
  });
}

function buildWhere(filters: JobFilters): {
  where: Prisma.JobWhereInput;
  center: { lat: number; lng: number; radius: number } | null;
} {
  const where: Prisma.JobWhereInput = visibleJobsWhere();
  const and: Prisma.JobWhereInput[] = [];
  let center: { lat: number; lng: number; radius: number } | null = null;

  const city = filters.city ? findCity(filters.city) : undefined;
  if (filters.city) {
    if (city) {
      // Ville connue : filtre géographique réel (rayon explicite ou rayon par défaut), plus les offres
      // sans coordonnées portant exactement ce nom de ville, plus le télétravail complet.
      const radius = filters.radius ?? DEFAULT_CITY_RADIUS_KM;
      center = { lat: city.lat, lng: city.lng, radius };
      const box = boundingBox({ lat: city.lat, lng: city.lng }, radius);
      and.push({
        OR: [
          {
            latitude: { gte: box.minLat, lte: box.maxLat },
            longitude: { gte: box.minLng, lte: box.maxLng },
          },
          { latitude: null, city: { equals: city.name, mode: "insensitive" } },
          { remote: "FULL" },
        ],
      });
    } else {
      and.push({ city: { equals: filters.city, mode: "insensitive" } });
    }
  }
  if (filters.department)
    and.push({ department: { equals: filters.department, mode: "insensitive" } });
  if (filters.region) and.push({ region: { equals: filters.region, mode: "insensitive" } });
  if (filters.remote.length) and.push({ remote: { in: filters.remote } });
  if (filters.contracts.length) and.push({ contractType: { in: filters.contracts } });
  if (filters.durations.length) and.push({ durationMonths: { in: filters.durations } });
  if (filters.sectors.length) and.push({ sector: { in: filters.sectors } });
  if (filters.families.length) and.push({ jobFamily: { in: filters.families } });
  const since = publishedWithinToDate(filters.published);
  if (since) and.push({ publishedAt: { gte: since } });
  if (filters.levels.length) {
    // L'offre accepte le niveau si min ≤ niveau ≤ max (bornes nulles = ouvertes)
    const order = ["CAP", "BAC", "BAC1", "BAC2", "BAC3", "BAC4", "BAC5"] as const;
    and.push({
      OR: filters.levels.map((level) => {
        const idx = order.indexOf(level);
        return {
          AND: [
            {
              OR: [
                { educationLevelMin: null },
                { educationLevelMin: { in: order.slice(0, idx + 1) } },
              ],
            },
            { OR: [{ educationLevelMax: null }, { educationLevelMax: { in: order.slice(idx) } }] },
          ],
        };
      }),
    });
  }
  if (and.length) where.AND = and;
  return { where, center };
}

/**
 * Recherche d'offres : filtres SQL + plein texte + scoring en mémoire.
 * Le classement « pertinence » utilise l'OpportunityPriorityScore quand un profil existe.
 */
export async function searchJobs(
  filters: JobFilters,
  ctx: UserContext = {},
): Promise<JobSearchResult> {
  const { where, center } = buildWhere(filters);
  let ranks: Map<string, number> | null = null;
  if (filters.q) {
    const hits = await getSearchProvider().searchJobs(filters.q, { limit: MAX_CANDIDATES });
    ranks = new Map(hits.map((h) => [h.id, h.rank]));
    if (ranks.size === 0)
      return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
    where.id = { in: [...ranks.keys()] };
  }

  const jobs = await prisma.job.findMany({
    where,
    include: jobCardInclude,
    orderBy: { publishedAt: "desc" },
    take: MAX_CANDIDATES,
  });

  // Filtrage précis par rayon
  const inRadius = center
    ? jobs.filter(
        (j) =>
          j.remote === "FULL" ||
          j.latitude === null ||
          j.longitude === null ||
          haversineKm(center, { lat: j.latitude, lng: j.longitude }) <= center.radius,
      )
    : jobs;

  const enrichment = await loadEnrichment(
    ctx.userId,
    inRadius.map((j) => j.id),
  );
  let scored = inRadius.map((job) => {
    let match: MatchResult | null = null;
    let priority: number | null = null;
    let distanceKm: number | null = null;
    if (ctx.candidate) {
      match = calculateMatchScore(ctx.candidate, toJobForMatching(job));
      distanceKm = match.distanceKm;
      priority = computePriority(ctx.candidate, job, match, enrichment.favorites.has(job.id));
    } else if (center && job.latitude !== null && job.longitude !== null) {
      distanceKm = haversineKm(center, { lat: job.latitude, lng: job.longitude });
    }
    return { job, match, priority, distanceKm, rank: ranks?.get(job.id) ?? 0 };
  });

  if (filters.minMatch) scored = scored.filter((s) => (s.match?.total ?? 0) >= filters.minMatch!);

  const sort = filters.sort;
  scored.sort((a, b) => {
    if (sort === "recent")
      return (
        b.job.publishedAt.getTime() - a.job.publishedAt.getTime() ||
        b.job.discoveredAt.getTime() - a.job.discoveredAt.getTime()
      );
    if (sort === "match")
      return (
        (b.match?.total ?? 0) - (a.match?.total ?? 0) ||
        b.job.publishedAt.getTime() - a.job.publishedAt.getTime()
      );
    if (sort === "distance") return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    // pertinence
    if (ranks) {
      const textDiff = b.rank - a.rank;
      if (Math.abs(textDiff) > 0.15) return textDiff;
    }
    if (a.priority !== null && b.priority !== null && a.priority !== b.priority)
      return b.priority - a.priority;
    // À pertinence égale : les offres découvertes récemment (« Nouveau ») d'abord, puis les plus récentes.
    const newA = Date.now() - a.job.discoveredAt.getTime() < 48 * 3_600_000 ? 1 : 0;
    const newB = Date.now() - b.job.discoveredAt.getTime() < 48 * 3_600_000 ? 1 : 0;
    if (newA !== newB) return newB - newA;
    return b.job.publishedAt.getTime() - a.job.publishedAt.getTime();
  });

  const total = scored.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const slice = scored.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const items = slice.map((s) =>
    toJobCard(s.job, ctx, enrichment, {
      match: s.match,
      distanceKm: s.distanceKm,
      priority: s.priority,
    }),
  );
  return { items, total, page, pageSize: PAGE_SIZE, totalPages };
}

export const getJobBySlug = cache(async (slug: string) => {
  return prisma.job.findUnique({
    where: { slug },
    include: {
      ...jobCardInclude,
      company: true,
      sourceEntries: {
        include: { source: { select: { key: true, name: true, type: true, priority: true } } },
        orderBy: [{ isPrimary: "desc" }, { firstSeenAt: "asc" }],
      },
      duplicates: { select: { id: true, sourceUrl: true, source: true } },
    },
  });
});

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobBySlug>>>;

export async function getJobCardById(id: string, ctx: UserContext): Promise<JobCardData | null> {
  const job = await prisma.job.findUnique({ where: { id }, include: jobCardInclude });
  if (!job) return null;
  const enrichment = await loadEnrichment(ctx.userId, [job.id]);
  return toJobCard(job, ctx, enrichment);
}

/** Meilleures offres pour un candidat (hors offres déjà en candidature), triées par priorité. */
export async function getTopMatches(
  ctx: Required<Pick<UserContext, "userId" | "candidate">>,
  options?: { limit?: number; minScore?: number; excludeApplied?: boolean },
): Promise<JobCardData[]> {
  const limit = options?.limit ?? 3;
  const minScore = options?.minScore ?? 0;
  const candidate = ctx.candidate;
  if (!candidate) return [];
  const where: Prisma.JobWhereInput = visibleJobsWhere();
  if (
    candidate.latitude !== null &&
    candidate.longitude !== null &&
    candidate.mobility !== "NATIONAL"
  ) {
    const box = boundingBox(
      { lat: candidate.latitude, lng: candidate.longitude },
      Math.max(candidate.maxRadiusKm * 1.5, 40),
    );
    where.OR = [
      {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
      { remote: "FULL" },
      ...(candidate.region ? [{ region: candidate.region }] : []),
    ];
  }
  if (options?.excludeApplied !== false) {
    where.applications = { none: { userId: ctx.userId, archivedAt: null } };
  }
  const jobs = await prisma.job.findMany({
    where,
    include: jobCardInclude,
    orderBy: { publishedAt: "desc" },
    take: MAX_CANDIDATES,
  });
  const enrichment = await loadEnrichment(
    ctx.userId,
    jobs.map((j) => j.id),
  );
  return jobs
    .map((job) => {
      const match = calculateMatchScore(candidate, toJobForMatching(job));
      const priority = computePriority(candidate, job, match, enrichment.favorites.has(job.id));
      return { job, match, priority };
    })
    .filter((s) => s.match.total >= minScore)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((s) =>
      toJobCard(s.job, ctx, enrichment, {
        match: s.match,
        distanceKm: s.match.distanceKm,
        priority: s.priority,
      }),
    );
}

export async function countNewJobs(
  ctx: { candidate: CandidateForMatching | null },
  sinceHours = 24,
): Promise<number> {
  const where: Prisma.JobWhereInput = {
    ...visibleJobsWhere(),
    publishedAt: { gte: new Date(Date.now() - sinceHours * 3_600_000) },
  };
  const c = ctx.candidate;
  if (
    c?.latitude !== null &&
    c?.latitude !== undefined &&
    c.longitude !== null &&
    c.mobility !== "NATIONAL"
  ) {
    const box = boundingBox({ lat: c.latitude, lng: c.longitude }, c.maxRadiusKm);
    where.OR = [
      {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
      { remote: "FULL" },
    ];
  }
  if (c?.jobFamily) where.jobFamily = c.jobFamily;
  return prisma.job.count({ where });
}

export const getRecentJobs = cache(async (limit = 6): Promise<JobCardData[]> => {
  const jobs = await prisma.job.findMany({
    where: visibleJobsWhere(),
    include: jobCardInclude,
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  return jobs.map((j) => toJobCard(j, { candidate: null }));
});

export const getJobStats = cache(async () => {
  const [jobs, companies, cities, last24h] = await Promise.all([
    prisma.job.count({ where: visibleJobsWhere() }),
    prisma.company.count({ where: { isPlaceholder: false, ...demoFilter() } }),
    prisma.job.groupBy({ by: ["city"], where: visibleJobsWhere() }).then((g) => g.length),
    prisma.job.count({
      where: { ...visibleJobsWhere(), publishedAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);
  return { jobs, companies, cities, last24h };
});

export async function getJobsForCityPage(
  cityName: string,
  options?: { family?: string; limit?: number },
) {
  const where: Prisma.JobWhereInput = {
    ...visibleJobsWhere(),
    city: { equals: cityName, mode: "insensitive" },
  };
  if (options?.family) where.jobFamily = options.family;
  const [jobs, total, byFamily] = await Promise.all([
    prisma.job.findMany({
      where,
      include: jobCardInclude,
      orderBy: { publishedAt: "desc" },
      take: options?.limit ?? 24,
    }),
    prisma.job.count({ where }),
    prisma.job.groupBy({
      by: ["jobFamily"],
      where: { ...visibleJobsWhere(), city: { equals: cityName, mode: "insensitive" } },
      _count: { _all: true },
    }),
  ]);
  return {
    jobs: jobs.map((j) => toJobCard(j, { candidate: null })),
    total,
    byFamily: byFamily
      .map((f) => ({ family: f.jobFamily, count: f._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function incrementJobView(jobId: string): Promise<void> {
  try {
    await prisma.job.update({ where: { id: jobId }, data: { viewCount: { increment: 1 } } });
  } catch (error) {
    log.warn("Impossible d'incrémenter les vues", { jobId, error: String(error) });
  }
}

export async function getJobsByIds(ids: string[], ctx: UserContext): Promise<JobCardData[]> {
  if (ids.length === 0) return [];
  const jobs = await prisma.job.findMany({ where: { id: { in: ids } }, include: jobCardInclude });
  const enrichment = await loadEnrichment(ctx.userId, ids);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return ids
    .map((id) => byId.get(id))
    .filter((j): j is JobWithCard => Boolean(j))
    .map((j) => toJobCard(j, ctx, enrichment));
}

/** Détail complet d'une offre, enrichi du score et des trajets si un profil existe. */
export async function getJobDetail(
  slug: string,
  ctx: UserContext & {
    profile?: {
      latitude: number | null;
      longitude: number | null;
      schoolLatitude: number | null;
      schoolLongitude: number | null;
    } | null;
  },
): Promise<JobDetailData | null> {
  const job = await getJobBySlug(slug);
  if (!job) return null;
  const [enrichment, counts] = await Promise.all([
    loadEnrichment(ctx.userId, [job.id]),
    prisma.company.findUnique({
      where: { id: job.companyId },
      select: {
        _count: {
          select: {
            contacts: { where: { optOutAt: null } },
            jobs: { where: { isActive: true, canonicalJobId: null } },
          },
        },
      },
    }),
  ]);
  const card = toJobCard(job, ctx, enrichment);
  const { estimateTravel } = await import("@/lib/geo/travel-time");
  const travel: JobDetailData["travel"] = { home: null, school: null };
  if (job.latitude !== null && job.longitude !== null && ctx.profile) {
    const to = { lat: job.latitude, lng: job.longitude };
    if (ctx.profile.latitude !== null && ctx.profile.longitude !== null) {
      const t = await estimateTravel({ lat: ctx.profile.latitude, lng: ctx.profile.longitude }, to);
      travel.home = { minutes: t.minutes, distanceKm: t.distanceKm, quality: t.quality };
    }
    if (ctx.profile.schoolLatitude !== null && ctx.profile.schoolLongitude !== null) {
      const t = await estimateTravel(
        { lat: ctx.profile.schoolLatitude, lng: ctx.profile.schoolLongitude },
        to,
      );
      travel.school = { minutes: t.minutes, distanceKm: t.distanceKm, quality: t.quality };
    }
  }
  return {
    ...card,
    description: job.description,
    missions: job.missions,
    requirements: job.requirements,
    benefits: job.benefits,
    startDate: job.startDate?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    postalCode: job.postalCode,
    latitude: job.latitude,
    longitude: job.longitude,
    sourceUrl: safeExternalUrl(job.sourceUrl),
    applicationUrl: safeExternalUrl(job.applicationUrl),
    applicationEmail: job.applicationEmail,
    applicationLabel: job.applicationLabel,
    sourceName: job.sourceEntries[0]?.source.name ?? SOURCE_LABELS[job.source] ?? job.source,
    sources: job.sourceEntries.map((e) => ({
      key: e.source.key,
      name: e.source.name,
      url: safeExternalUrl(e.url),
      applicationUrl: safeExternalUrl(e.applicationUrl),
      isPrimary: e.isPrimary,
      status: e.status,
      lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
    })),
    otherSources: job.duplicates.map((d) => ({
      name: SOURCE_LABELS[d.source] ?? d.source,
      url: safeExternalUrl(d.sourceUrl),
    })),
    dataQualityScore: job.dataQualityScore,
    viewCount: job.viewCount,
    companyDetail: {
      sizeOrigin: job.company.sizeOrigin,
      description: job.company.description,
      website: job.company.website,
      careersUrl: job.company.careersUrl,
      headcount: job.company.headcount,
      city: job.company.city,
      hiresApprentices: job.company.hiresApprentices,
      apprenticeCountEstimate: job.company.apprenticeCountEstimate,
      contactsCount: counts?._count.contacts ?? 0,
      activeJobsCount: counts?._count.jobs ?? 0,
    },
    travel,
  };
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
import type { NormalizedJob } from "@/services/job-sources/types";

const log = createLogger("ingestion:company-match");

/** Entreprise fictive de rattachement pour les offres anonymes. Jamais listée, jamais recommandée. */
export const PLACEHOLDER_COMPANY_SLUG = "employeur-non-communique";

export { mergeDataSources, type CompanySourceRef } from "./data-sources";
import { mergeDataSources, type CompanySourceRef } from "./data-sources";

export type CompanyMatch = { id: string; created: boolean; matchedBy: "placeholder" | "normalized-name" | "similar-name" | "created" };

async function uniqueCompanySlug(base: string): Promise<string> {
  const root = slugify(base).slice(0, 80) || "entreprise";
  const existing = await prisma.company.findMany({ where: { slug: { startsWith: root } }, select: { slug: true } });
  if (!existing.some((c) => c.slug === root)) return root;
  for (let i = 2; i < 500; i++) if (!existing.some((c) => c.slug === `${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Rapprochement offre ↔ entreprise (étape ENRICHMENT).
 *   1. employeur non communiqué → entreprise de rattachement « Employeur non communiqué » ;
 *   2. nom normalisé identique (même département de préférence) ;
 *   3. similarité trigramme ≥ 0,85 dans le même département ;
 *   4. sinon création avec provenance (dataOrigin REAL = issue d'une offre officielle, taille inconnue).
 */
export async function findOrCreateCompanyForJob(job: NormalizedJob, ctx: { sourceKey: string; sourceLabel: string; now: Date }): Promise<CompanyMatch> {
  const ref: CompanySourceRef = { source: ctx.sourceKey, label: ctx.sourceLabel, url: job.sourceUrl, fetchedAt: ctx.now.toISOString() };

  if (!job.companyNameRaw) {
    const placeholder = await prisma.company.upsert({
      where: { slug: PLACEHOLDER_COMPANY_SLUG },
      update: { lastActivityAt: job.publishedAt },
      create: {
        slug: PLACEHOLDER_COMPANY_SLUG,
        name: job.companyName,
        nameNormalized: job.companyNameNormalized,
        description: "Certaines offres officielles ne communiquent pas le nom de l'employeur. Elles sont rattachées à cette fiche technique, qui n'est pas une entreprise réelle.",
        sector: "other",
        size: "PME",
        sizeOrigin: "UNKNOWN",
        city: "France",
        jobFamilies: [],
        technologies: [],
        dataOrigin: "UNKNOWN",
        isDemo: false,
        isPlaceholder: true,
        lastActivityAt: job.publishedAt,
      },
      select: { id: true },
    });
    return { id: placeholder.id, created: false, matchedBy: "placeholder" };
  }

  const candidates = await prisma.company.findMany({
    where: { nameNormalized: job.companyNameNormalized, isPlaceholder: false },
    select: { id: true, department: true, isDemo: true },
    take: 10,
  });
  const exact = candidates.find((c) => !c.isDemo && c.department && job.department && c.department === job.department) ?? candidates.find((c) => !c.isDemo) ?? candidates[0];
  if (exact) {
    await touchCompany(exact.id, job, ref);
    return { id: exact.id, created: false, matchedBy: "normalized-name" };
  }

  if (job.companyNameNormalized.length >= 4) {
    const similar = await prisma.$queryRaw<Array<{ id: string; department: string | null; sim: number }>>(Prisma.sql`
      SELECT id, department, similarity("nameNormalized", ${job.companyNameNormalized})::float AS sim
      FROM company
      WHERE "isPlaceholder" = false AND "isDemo" = false AND "nameNormalized" % ${job.companyNameNormalized}
      ORDER BY sim DESC
      LIMIT 3
    `);
    const best = similar.find((c) => c.sim >= 0.85 && (!c.department || !job.department || c.department === job.department));
    if (best) {
      await touchCompany(best.id, job, ref);
      return { id: best.id, created: false, matchedBy: "similar-name" };
    }
  }

  const created = await prisma.company.create({
    data: {
      name: job.companyName,
      nameNormalized: job.companyNameNormalized,
      slug: await uniqueCompanySlug(job.companyName),
      description: job.companyDescription,
      sector: job.sector,
      size: "PME",
      sizeOrigin: "UNKNOWN",
      website: job.companyWebsite,
      logoUrl: job.companyLogoUrl,
      city: job.city || "France",
      postalCode: job.postalCode,
      department: job.department,
      region: job.region,
      latitude: job.latitude,
      longitude: job.longitude,
      nafCode: job.nafCode,
      technologies: [],
      jobFamilies: [job.jobFamily],
      hiresApprentices: true,
      isHiring: true,
      lastActivityAt: job.publishedAt,
      dataOrigin: "REAL",
      isDemo: false,
      dataSources: [ref] as unknown as Prisma.InputJsonValue,
      lastVerifiedAt: ctx.now,
    },
    select: { id: true },
  });
  log.debug("Entreprise créée depuis une offre", { company: job.companyName, source: ctx.sourceKey });
  return { id: created.id, created: true, matchedBy: "created" };
}

async function touchCompany(id: string, job: NormalizedJob, ref: CompanySourceRef): Promise<void> {
  const current = await prisma.company.findUnique({ where: { id }, select: { jobFamilies: true, dataSources: true, website: true, logoUrl: true, description: true, lastActivityAt: true, isDemo: true } });
  if (!current || current.isDemo) return;
  await prisma.company.update({
    where: { id },
    data: {
      isHiring: true,
      hiresApprentices: true,
      lastActivityAt: !current.lastActivityAt || current.lastActivityAt < job.publishedAt ? job.publishedAt : undefined,
      jobFamilies: current.jobFamilies.includes(job.jobFamily) ? undefined : [...current.jobFamilies, job.jobFamily],
      website: current.website ?? job.companyWebsite ?? undefined,
      logoUrl: current.logoUrl ?? job.companyLogoUrl ?? undefined,
      description: current.description ?? job.companyDescription ?? undefined,
      dataSources: mergeDataSources(current.dataSources, ref) as unknown as Prisma.InputJsonValue,
    },
  });
}

import "server-only";
import { prisma } from "@/lib/db";
import type { FavoriteCollection } from "@/generated/prisma/enums";
import type { CandidateForMatching } from "@/lib/matching";
import { jobCardInclude, toJobCard } from "@/features/jobs/server/queries";
import { companyCardInclude, toCompanyCard } from "@/features/companies/server/queries";
import type { JobCardData } from "@/features/jobs/types";
import type { CompanyCardData } from "@/features/companies/types";

export type FavoriteEntry = { id: string; collection: FavoriteCollection; note: string | null; createdAt: Date; job: JobCardData | null; company: CompanyCardData | null };

export async function getFavorites(userId: string, candidate: CandidateForMatching | null): Promise<FavoriteEntry[]> {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { job: { include: jobCardInclude }, company: { include: companyCardInclude } },
  });
  const jobIds = favorites.map((f) => f.jobId).filter((id): id is string => Boolean(id));
  const applications = await prisma.application.findMany({ where: { userId, jobId: { in: jobIds }, archivedAt: null }, select: { id: true, jobId: true, status: true } });
  const appMap = new Map(applications.map((a) => [a.jobId!, { id: a.id, status: a.status }]));
  const ctx = { userId, candidate };
  return favorites.map((f) => ({
    id: f.id,
    collection: f.collection,
    note: f.note,
    createdAt: f.createdAt,
    job: f.job ? toJobCard(f.job, ctx, { favorites: new Map([[f.job.id, f.collection]]), applications: appMap }) : null,
    company: f.company ? toCompanyCard(f.company, ctx, { favorites: new Set([f.company.id]), applications: new Set() }) : null,
  }));
}

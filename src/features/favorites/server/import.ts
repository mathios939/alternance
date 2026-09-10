import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { trackActivity } from "@/features/activity/server/track";

export type ImportFavoritesResult = { added: number; alreadyPresent: number; unknown: number };

/**
 * Ajoute au compte les favoris sauvegardés sans compte (identifiants conservés par le navigateur).
 * Idempotent : un favori déjà présent (quelle que soit sa collection) n'est jamais dupliqué,
 * un identifiant inconnu est ignoré, rien n'est supprimé. Deux appels concurrents sont absorbés
 * par les contraintes d'unicité de la table (l'insertion en doublon est comptée « déjà présent »).
 */
export async function importFavoritesForUser(userId: string, input: { jobIds: string[]; companyIds: string[] }): Promise<ImportFavoritesResult> {
  const jobIds = Array.from(new Set(input.jobIds));
  const companyIds = Array.from(new Set(input.companyIds));
  const [jobs, companies, existing] = await Promise.all([
    jobIds.length ? prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true } }) : [],
    companyIds.length ? prisma.company.findMany({ where: { id: { in: companyIds }, isPlaceholder: false }, select: { id: true } }) : [],
    jobIds.length || companyIds.length ? prisma.favorite.findMany({ where: { userId, OR: [{ jobId: { in: jobIds } }, { companyId: { in: companyIds } }] }, select: { jobId: true, companyId: true } }) : [],
  ]);
  const hasJob = new Set(existing.map((f) => f.jobId).filter(Boolean));
  const hasCompany = new Set(existing.map((f) => f.companyId).filter(Boolean));
  const result: ImportFavoritesResult = { added: 0, alreadyPresent: 0, unknown: jobIds.length - jobs.length + (companyIds.length - companies.length) };

  const create = async (data: Prisma.FavoriteUncheckedCreateInput) => {
    try {
      await prisma.favorite.create({ data });
      result.added++;
    } catch (error) {
      // Course entre deux imports (double clic, deux onglets) : la contrainte d'unicité a fait son travail.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") result.alreadyPresent++;
      else throw error;
    }
  };
  for (const job of jobs) {
    if (hasJob.has(job.id)) result.alreadyPresent++;
    else await create({ userId, jobId: job.id, collection: "TO_APPLY" });
  }
  for (const company of companies) {
    if (hasCompany.has(company.id)) result.alreadyPresent++;
    else await create({ userId, companyId: company.id, collection: "COMPANIES" });
  }
  if (result.added > 0) {
    await trackActivity({ userId, type: "JOB_SAVED", title: `${result.added} favori${result.added > 1 ? "s" : ""} repris depuis ce navigateur`, metadata: { source: "guest-import", added: result.added } });
  }
  return result;
}

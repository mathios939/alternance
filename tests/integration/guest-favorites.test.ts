import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { prisma } from "@/lib/db";
import { importFavoritesForUser } from "@/features/favorites/server/import";
import { getFavorites } from "@/features/favorites/server/queries";
import { getJobsByIds } from "@/features/jobs/server/queries";
import { getCompaniesByIds } from "@/features/companies/server/queries";

/**
 * Favoris sans compte → compte : import idempotent, sans doublon, robuste aux appels répétés et
 * concurrents ; isolation stricte entre deux utilisateurs et pour un visiteur (aucun identifiant).
 */
const PREFIX = "gtest-";
const ids = { userA: `${PREFIX}user-a`, userB: `${PREFIX}user-b`, company: `${PREFIX}company`, job1: `${PREFIX}job-1`, job2: `${PREFIX}job-2` };

async function cleanup() {
  await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } });
  await prisma.job.deleteMany({ where: { id: { in: [ids.job1, ids.job2] } } });
  await prisma.company.deleteMany({ where: { id: ids.company } });
}

describe.skipIf(!process.env["DATABASE_URL"])("import des favoris visiteur (base locale)", () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.user.createMany({ data: [{ id: ids.userA, name: "Gtest A", email: `${PREFIX}a@alternance.test` }, { id: ids.userB, name: "Gtest B", email: `${PREFIX}b@alternance.test` }] });
    await prisma.company.create({ data: { id: ids.company, slug: `${PREFIX}atlantic`, name: "Gtest Atlantic", sector: "tech", size: "PME", city: "Nantes", isDemo: false, dataOrigin: "REAL", sizeOrigin: "UNKNOWN" } });
    const base = { companyId: ids.company, description: "Contrat d'apprentissage de 24 mois à Nantes : développement web au sein d'une équipe produit, revues de code et tests automatisés.", city: "Nantes", jobFamily: "dev", sector: "tech", publishedAt: new Date(), isDemo: false, dataOrigin: "REAL" as const };
    await prisma.job.createMany({ data: [{ id: ids.job1, slug: `${PREFIX}job-1`, title: "Développeur web (gtest 1)", ...base }, { id: ids.job2, slug: `${PREFIX}job-2`, title: "Développeur web (gtest 2)", ...base }] });
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("ajoute les favoris connus, ignore les inconnus, et ne duplique jamais lors d'un second import", async () => {
    const first = await importFavoritesForUser(ids.userA, { jobIds: [ids.job1, ids.job2, "inconnu-1", ids.job1], companyIds: [ids.company, "inconnu-2"] });
    expect(first).toEqual({ added: 3, alreadyPresent: 0, unknown: 2 });
    const second = await importFavoritesForUser(ids.userA, { jobIds: [ids.job1, ids.job2], companyIds: [ids.company] });
    expect(second).toEqual({ added: 0, alreadyPresent: 3, unknown: 0 });
    expect(await prisma.favorite.count({ where: { userId: ids.userA } })).toBe(3);
  });

  it("respecte un favori déjà rangé dans une autre collection", async () => {
    await prisma.favorite.updateMany({ where: { userId: ids.userA, jobId: ids.job1 }, data: { collection: "PRIORITY" } });
    const result = await importFavoritesForUser(ids.userA, { jobIds: [ids.job1], companyIds: [] });
    expect(result).toEqual({ added: 0, alreadyPresent: 1, unknown: 0 });
    const favs = await prisma.favorite.findMany({ where: { userId: ids.userA, jobId: ids.job1 } });
    expect(favs).toHaveLength(1);
    expect(favs[0]?.collection).toBe("PRIORITY");
  });

  it("absorbe deux imports simultanés (double clic, deux onglets) sans doublon ni erreur", async () => {
    await prisma.favorite.deleteMany({ where: { userId: ids.userB } });
    const [r1, r2] = await Promise.all([importFavoritesForUser(ids.userB, { jobIds: [ids.job2], companyIds: [ids.company] }), importFavoritesForUser(ids.userB, { jobIds: [ids.job2], companyIds: [ids.company] })]);
    expect(r1.added + r2.added).toBe(2);
    expect(r1.alreadyPresent + r2.alreadyPresent).toBe(2);
    expect(await prisma.favorite.count({ where: { userId: ids.userB } })).toBe(2);
  });

  it("isole strictement les favoris de deux utilisateurs et d'un visiteur", async () => {
    const [favA, favB] = await Promise.all([getFavorites(ids.userA, null), getFavorites(ids.userB, null)]);
    expect(favA.map((f) => f.job?.id ?? f.company?.id).sort()).toEqual([ids.company, ids.job1, ids.job2].sort());
    expect(favB.map((f) => f.job?.id ?? f.company?.id).sort()).toEqual([ids.company, ids.job2].sort());

    const forB = await getJobsByIds([ids.job1, ids.job2], { userId: ids.userB, candidate: null });
    expect(forB.map((j) => [j.id, j.isFavorite])).toEqual([[ids.job1, false], [ids.job2, true]]);
    const forGuest = await getJobsByIds([ids.job1, ids.job2], { userId: undefined, candidate: null });
    expect(forGuest.every((j) => !j.isFavorite && j.applicationStatus === null)).toBe(true);
    const companiesForGuest = await getCompaniesByIds([ids.company], { userId: undefined, candidate: null });
    expect(companiesForGuest[0]?.isFavorite).toBe(false);
    const companiesForA = await getCompaniesByIds([ids.company], { userId: ids.userA, candidate: null });
    expect(companiesForA[0]?.isFavorite).toBe(true);
  });
});

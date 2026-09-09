import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { prisma } from "@/lib/db";
import { ManualProvider } from "@/services/job-sources/providers/manual";
import type { RawJob } from "@/services/job-sources/types";
import { EXPIRATION_RULES, expireJobs, runIngestion, verifySourceJobs } from "@/services/ingestion";

/**
 * Pipeline complet contre la base locale : création, mise à jour, rattachement multi-sources,
 * doublon probable, rejets, contacts publiés, vérification et expiration.
 * Les données créées portent le préfixe « itest- » et sont supprimées à la fin.
 */
const PREFIX = "itest-";
const now = () => new Date("2026-09-09T12:00:00Z");

const jobA: RawJob = {
  externalId: `${PREFIX}A`,
  title: "Développeur web en alternance (H/F)",
  companyName: "Itest Atlantic Software",
  companyWebsite: "https://itest-atlantic.example",
  description: "Contrat d'apprentissage de 24 mois à Nantes : développement d'applications web React et Node.js au sein d'une équipe produit de huit personnes, revues de code et tests automatisés.",
  city: "Nantes",
  postalCode: "44000",
  latitude: 47.2184,
  longitude: -1.5536,
  contractType: "APPRENTISSAGE",
  isAlternance: true,
  publishedAt: new Date("2026-09-01"),
  sourceUrl: "https://source-a.example/offres/A",
  applicationUrl: "https://itest-atlantic.example/carrieres/dev",
  applicationEmail: "recrutement@itest-atlantic.example",
  applicationLabel: "Mme MARTIN Julie - Responsable RH",
  skills: ["React", "Node.js"],
};
const jobB: RawJob = {
  externalId: `${PREFIX}B`,
  title: "Assistant comptable en alternance",
  companyName: null,
  description: "Contrat de professionnalisation de 12 mois dans un cabinet d'expertise comptable rennais : saisie, lettrage, rapprochements bancaires et déclarations de TVA sous supervision.",
  city: "Rennes",
  isAlternance: true,
  publishedAt: new Date("2026-09-03"),
  sourceUrl: "https://source-a.example/offres/B",
};
const rejected: RawJob = { externalId: `${PREFIX}R`, title: "Trop court", companyName: "X", description: "court", city: "Nantes", publishedAt: new Date("2026-09-01") };

const providerA = new ManualProvider(async () => [jobA, jobB, rejected], { key: `${PREFIX}source-a`, name: "Source A (test)", priority: 40 });
/** Même offre que A, vue depuis une seconde source à priorité plus haute (page carrière). */
const providerB = new ManualProvider(
  async () => [{ ...jobA, externalId: `${PREFIX}A-bis`, title: "Développeur web H/F – alternance", sourceUrl: "https://source-b.example/jobs/42", applicationUrl: "https://itest-atlantic.example/carrieres/dev-web", publishedAt: new Date("2026-09-02") }],
  { key: `${PREFIX}source-b`, name: "Source B (test)", priority: 90 },
);

async function cleanup() {
  const sources = await prisma.jobSource.findMany({ where: { key: { startsWith: PREFIX } }, select: { id: true } });
  const entries = await prisma.jobSourceEntry.findMany({ where: { sourceId: { in: sources.map((s) => s.id) } }, select: { jobId: true } });
  const jobIds = [...new Set(entries.map((e) => e.jobId))];
  await prisma.contact.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { company: { name: { startsWith: "Itest" } } }] } });
  await prisma.job.deleteMany({ where: { OR: [{ id: { in: jobIds } }, { canonicalJobId: { in: jobIds } }] } });
  await prisma.company.deleteMany({ where: { name: { startsWith: "Itest" } } });
  await prisma.ingestionRun.deleteMany({ where: { sourceKey: { startsWith: PREFIX } } });
  await prisma.jobSource.deleteMany({ where: { key: { startsWith: PREFIX } } });
}

describe.skipIf(!process.env["DATABASE_URL"])("pipeline d'ingestion (base locale)", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("crée les offres valides, rejette les invalides et journalise l'exécution", async () => {
    const report = await runIngestion({ provider: providerA, trigger: "test", now });
    expect(report.fetched).toBe(3);
    expect(report.created).toBe(2);
    expect(report.rejected).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.runId).toBeTruthy();
    const run = await prisma.ingestionRun.findUniqueOrThrow({ where: { id: report.runId! } });
    expect(run.status).toBe("SUCCESS");
    expect(run.createdCount).toBe(2);
    expect(run.rejectedCount).toBe(1);
    expect(run.finishedAt).not.toBeNull();

    const job = await prisma.job.findFirstOrThrow({ where: { sourceEntries: { some: { externalId: `${PREFIX}A` } } }, include: { company: true, sourceEntries: true, skills: { include: { skill: true } }, contacts: true } });
    expect(job.isDemo).toBe(false);
    expect(job.dataOrigin).toBe("REAL");
    expect(job.verificationStatus).toBe("ACTIVE");
    expect(job.lastVerifiedAt).not.toBeNull();
    expect(job.normalizedTitle).toBe("developpeur web");
    expect(job.dataQualityScore).toBeGreaterThanOrEqual(80);
    expect(job.company.name).toBe("Itest Atlantic Software");
    expect(job.company.dataOrigin).toBe("REAL");
    expect(job.company.sizeOrigin).toBe("UNKNOWN");
    expect(job.company.website).toBe("https://itest-atlantic.example");
    expect(job.skills.map((s) => s.skill.slug)).toEqual(expect.arrayContaining(["react", "node-js"]));
    expect(job.sourceEntries).toHaveLength(1);
    expect(job.sourceEntries[0]?.isPrimary).toBe(true);
    // Contact nominatif publié dans l'offre, avec provenance
    expect(job.contacts).toHaveLength(1);
    expect(job.contacts[0]).toMatchObject({ firstName: "Julie", lastName: "MARTIN", email: "recrutement@itest-atlantic.example", source: "JOB_POSTING", publiclyAvailable: true, dataOrigin: "REAL", isDemo: false });

    const anonymous = await prisma.job.findFirstOrThrow({ where: { sourceEntries: { some: { externalId: `${PREFIX}B` } } }, include: { company: true, contacts: true } });
    expect(anonymous.companyNameRaw).toBeNull();
    expect(anonymous.company.isPlaceholder).toBe(true);
    expect(anonymous.contacts).toHaveLength(0);
    expect(anonymous.latitude).not.toBeNull();
  });

  it("met à jour sans dupliquer lors d'une seconde exécution", async () => {
    const report = await runIngestion({ provider: providerA, trigger: "test", now });
    expect(report.created).toBe(0);
    expect(report.updated).toBe(2);
    expect(report.rejected).toBe(1);
    expect(await prisma.job.count({ where: { company: { name: "Itest Atlantic Software" } } })).toBe(1);
  });

  it("rattache la même offre venue d'une autre source et préfère la page carrière pour candidater", async () => {
    const report = await runIngestion({ provider: providerB, trigger: "test", now });
    expect(report.created).toBe(0);
    expect(report.duplicates).toBe(1);
    const job = await prisma.job.findFirstOrThrow({ where: { sourceEntries: { some: { externalId: `${PREFIX}A` } } }, include: { sourceEntries: { include: { source: true } } } });
    expect(job.sourceEntries).toHaveLength(2);
    const primary = job.sourceEntries.find((e) => e.isPrimary);
    expect(primary?.source.key).toBe(`${PREFIX}source-b`);
    expect(job.applicationUrl).toBe("https://itest-atlantic.example/carrieres/dev-web");
    expect(job.sourceEntries.find((e) => e.externalId === `${PREFIX}A-bis`)?.duplicateConfidence).toBeGreaterThanOrEqual(0.92);
    // Une seule offre visible pour l'utilisateur
    expect(await prisma.job.count({ where: { company: { name: "Itest Atlantic Software" }, canonicalJobId: null } })).toBe(1);
  });

  it("marque UNKNOWN puis EXPIRED les offres non re-vérifiées, sans toucher aux offres de démonstration", async () => {
    const job = await prisma.job.findFirstOrThrow({ where: { sourceEntries: { some: { externalId: `${PREFIX}B` } } } });
    const stale = new Date(now().getTime() - (EXPIRATION_RULES.staleAfterDays + 1) * 86_400_000);
    await prisma.job.update({ where: { id: job.id }, data: { lastVerifiedAt: stale } });
    const demoBefore = await prisma.job.count({ where: { isDemo: true, isActive: true } });
    const first = await expireJobs({ now, trigger: "test" });
    expect(first.markedUnknown).toBeGreaterThanOrEqual(1);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).verificationStatus).toBe("UNKNOWN");

    const dead = new Date(now().getTime() - (EXPIRATION_RULES.expireUnverifiedAfterDays + 1) * 86_400_000);
    await prisma.job.update({ where: { id: job.id }, data: { lastVerifiedAt: dead } });
    const second = await expireJobs({ now, trigger: "test" });
    expect(second.expiredUnverified).toBeGreaterThanOrEqual(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.verificationStatus).toBe("EXPIRED");
    expect(after.isActive).toBe(false);
    expect(await prisma.job.count({ where: { isDemo: true, isActive: true } })).toBe(demoBefore);
  });

  it("ignore la vérification pour une source qui ne la supporte pas, sans erreur", async () => {
    const report = await verifySourceJobs({ provider: providerA, trigger: "test", now });
    expect(report.skipped).toBe(true);
    expect(report.reason).toMatch(/ne permet pas/);
  });

  it("journalise SKIPPED une source non configurée au lieu de simuler", async () => {
    const { FranceTravailProvider } = await import("@/services/job-sources/providers/france-travail");
    const provider = new FranceTravailProvider({});
    const report = await runIngestion({ provider, trigger: "test", now });
    expect(report.fetched).toBe(0);
    expect(report.errors[0]).toMatch(/FRANCE_TRAVAIL_CLIENT_ID/);
    const run = await prisma.ingestionRun.findUniqueOrThrow({ where: { id: report.runId! } });
    expect(run.status).toBe("SKIPPED");
    await prisma.ingestionRun.delete({ where: { id: run.id } });
  });
});

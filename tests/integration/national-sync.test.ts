import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { prisma } from "@/lib/db";
import type {
  FetchPage,
  FetchParams,
  JobSourceProvider,
  ProviderCapabilities,
  ProviderStatus,
  RawJob,
} from "@/services/job-sources/types";
import {
  runNationalSync,
  staleTerritories,
  syncTerritory,
} from "@/services/ingestion/national-sync";

/**
 * Synchronisation nationale contre la base locale, avec une source simulée qui se comporte comme
 * France Travail : filtre par département, fenêtre [since, until], nature de contrat, et tronque
 * au-delà de 3 résultats par requête (borne de pagination). Vérifie : découpe des morceaux tronqués,
 * point de reprise, « déjà à jour », verrou, interruption + reprise, réconciliation des offres disparues.
 */
const PREFIX = "natsync-";
const KEY = `${PREFIX}source`;
const CAP = 3;

type Seed = {
  id: string;
  nature: "E2" | "FS";
  publishedAt: Date;
  postalCode: string;
  city: string;
  title: string;
};

function toRaw(s: Seed): RawJob {
  return {
    externalId: `${PREFIX}${s.id}`,
    title: s.title,
    companyName: `Natsync Test ${s.city}`,
    description: `Contrat ${s.nature === "E2" ? "d'apprentissage" : "de professionnalisation"} de 24 mois à ${s.city} : développement d'applications web au sein d'une équipe produit, revues de code, tests automatisés et déploiements continus.`,
    city: s.city,
    postalCode: s.postalCode,
    department: s.postalCode.startsWith("44") ? "Loire-Atlantique" : "Ille-et-Vilaine",
    region: s.postalCode.startsWith("44") ? "Pays de la Loire" : "Bretagne",
    contractType: s.nature === "E2" ? "APPRENTISSAGE" : "PROFESSIONNALISATION",
    isAlternance: true,
    publishedAt: s.publishedAt,
    updatedAt: s.publishedAt,
    sourceUrl: `https://source-nat.example/offres/${s.id}`,
  };
}

class FakeNationalProvider implements JobSourceProvider {
  readonly key = KEY;
  readonly name = "Source nationale (test)";
  readonly type = "OTHER" as const;
  readonly priority = 40;
  readonly capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsIncrementalSync: true,
    supportsLocation: true,
    supportsRadius: false,
    supportsDetails: false,
    supportsSalary: false,
    supportsExpiration: false,
    supportsVerification: false,
  };
  calls: FetchParams[] = [];
  constructor(public seeds: Seed[]) {}
  async status(): Promise<ProviderStatus> {
    return { key: this.key, name: this.name, type: this.type, configured: true };
  }
  async contractNatures() {
    return ["E2", "FS"];
  }
  async fetchJobs(params: FetchParams): Promise<FetchPage> {
    this.calls.push(params);
    const natures = params.contractNatures ?? ["E2", "FS"];
    const matching = this.seeds
      .filter((s) => (params.department ? s.postalCode.startsWith(params.department) : true))
      .filter((s) => natures.includes(s.nature))
      .filter(
        (s) =>
          (!params.since || s.publishedAt >= params.since) &&
          (!params.until || s.publishedAt <= params.until),
      )
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const truncated = matching.length > CAP;
    const page = truncated && params.stopIfTruncated ? [] : matching.slice(0, CAP);
    return { jobs: page.map(toRaw), total: matching.length, requests: 1, warnings: [], truncated };
  }
}

const now = new Date("2026-09-10T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const seeds: Seed[] = [
  {
    id: "A",
    nature: "E2",
    publishedAt: daysAgo(1),
    postalCode: "44000",
    city: "Nantes",
    title: "Développeur web en alternance A",
  },
  {
    id: "B",
    nature: "E2",
    publishedAt: daysAgo(2),
    postalCode: "44800",
    city: "Saint-Herblain",
    title: "Développeur back-end en alternance B",
  },
  {
    id: "C",
    nature: "FS",
    publishedAt: daysAgo(3),
    postalCode: "44600",
    city: "Saint-Nazaire",
    title: "Assistant marketing en alternance C",
  },
  {
    id: "D",
    nature: "FS",
    publishedAt: daysAgo(4),
    postalCode: "44100",
    city: "Nantes",
    title: "Comptable en alternance D",
  },
  {
    id: "R",
    nature: "E2",
    publishedAt: daysAgo(2),
    postalCode: "35000",
    city: "Rennes",
    title: "Développeur web en alternance R",
  },
];

async function cleanup() {
  const source = await prisma.jobSource.findUnique({ where: { key: KEY }, select: { id: true } });
  if (source) {
    const entries = await prisma.jobSourceEntry.findMany({
      where: { sourceId: source.id },
      select: { jobId: true },
    });
    const jobIds = [...new Set(entries.map((e) => e.jobId))];
    await prisma.contact.deleteMany({
      where: { company: { name: { startsWith: "Natsync Test" } } },
    });
    await prisma.job.deleteMany({
      where: { OR: [{ id: { in: jobIds } }, { canonicalJobId: { in: jobIds } }] },
    });
  }
  await prisma.company.deleteMany({ where: { name: { startsWith: "Natsync Test" } } });
  await prisma.ingestionRun.deleteMany({ where: { sourceKey: KEY } });
  await prisma.syncCheckpoint.deleteMany({ where: { provider: KEY } });
  await prisma.jobSource.deleteMany({ where: { key: KEY } });
}

describe.skipIf(!process.env["DATABASE_URL"])("synchronisation nationale (base locale)", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("découpe un territoire tronqué par nature de contrat et enregistre un point de reprise SUCCESS", async () => {
    const provider = new FakeNationalProvider(seeds);
    const result = await syncTerritory({
      provider,
      territory: "44",
      window: "31d",
      trigger: "test",
      workerId: "w1",
      now: () => new Date(),
    });
    expect(result.status, JSON.stringify(result)).toBe("success");
    // 1 requête tronquée (4 offres > 3, arrêtée à la première page) puis 2 morceaux par nature (2 + 2), aucun tronqué.
    expect(result.chunks).toBe(3);
    expect(result.fetched).toBe(4);
    expect(result.created).toBe(4);
    expect(result.truncated).toBe(false);
    expect(provider.calls[0]?.contractNatures).toBeUndefined();
    expect(provider.calls.slice(1).map((c) => c.contractNatures)).toEqual([["E2"], ["FS"]]);
    const cp = await prisma.syncCheckpoint.findUniqueOrThrow({
      where: {
        provider_kind_territory_window: {
          provider: KEY,
          kind: "TERRITORY",
          territory: "44",
          window: "31d",
        },
      },
    });
    expect(cp.status).toBe("SUCCESS");
    expect(cp.lastSuccessAt).not.toBeNull();
    expect(cp.lockedBy).toBeNull();
    expect(cp.nextCursor).toBeNull();
    expect(cp.createdCount).toBe(4);
    expect(cp.requestCount).toBe(3);
    expect(
      await prisma.job.count({
        where: {
          sourceEntries: {
            some: {
              sourceId: (await prisma.jobSource.findUniqueOrThrow({ where: { key: KEY } })).id,
            },
          },
          department: "Loire-Atlantique",
        },
      }),
    ).toBe(4);
  });

  it("ignore un territoire déjà à jour, mais pas quand on force", async () => {
    const provider = new FakeNationalProvider(seeds);
    const fresh = await syncTerritory({
      provider,
      territory: "44",
      window: "31d",
      workerId: "w1",
      maxAgeHours: 20,
    });
    expect(fresh.status).toBe("fresh");
    expect(provider.calls).toHaveLength(0);
    const forced = await syncTerritory({
      provider,
      territory: "44",
      window: "31d",
      workerId: "w1",
    });
    expect(forced.status).toBe("success");
    expect(forced.created).toBe(0);
    // Même date d'actualisation côté source : simple pointage, aucune réécriture.
    expect(forced.updated).toBe(4);
    expect(forced.unchanged).toBe(4);
    const cp = await prisma.syncCheckpoint.findUniqueOrThrow({
      where: {
        provider_kind_territory_window: {
          provider: KEY,
          kind: "TERRITORY",
          territory: "44",
          window: "31d",
        },
      },
    });
    expect(cp.runCount).toBe(2);
  });

  it("refuse un territoire tenu par un autre worker, reprend un verrou expiré", async () => {
    const provider = new FakeNationalProvider(seeds);
    await prisma.syncCheckpoint.update({
      where: {
        provider_kind_territory_window: {
          provider: KEY,
          kind: "TERRITORY",
          territory: "44",
          window: "31d",
        },
      },
      data: { status: "RUNNING", lockedBy: "other", lockedAt: new Date() },
    });
    expect(
      (await syncTerritory({ provider, territory: "44", window: "31d", workerId: "w2" })).status,
    ).toBe("locked");
    await prisma.syncCheckpoint.update({
      where: {
        provider_kind_territory_window: {
          provider: KEY,
          kind: "TERRITORY",
          territory: "44",
          window: "31d",
        },
      },
      data: { lockedAt: new Date(Date.now() - 30 * 60_000) },
    });
    expect(
      (await syncTerritory({ provider, territory: "44", window: "31d", workerId: "w2" })).status,
    ).toBe("success");
  });

  it("s'interrompt au budget de temps en conservant le curseur, puis reprend là où il s'est arrêté", async () => {
    const provider = new FakeNationalProvider(seeds);
    const interrupted = await syncTerritory({
      provider,
      territory: "44",
      window: "7d",
      workerId: "w1",
      deadline: Date.now() - 1,
    });
    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.chunks).toBe(0);
    const cp = await prisma.syncCheckpoint.findUniqueOrThrow({
      where: {
        provider_kind_territory_window: {
          provider: KEY,
          kind: "TERRITORY",
          territory: "44",
          window: "7d",
        },
      },
    });
    expect(cp.status).toBe("PARTIAL");
    expect((cp.nextCursor as { pending: unknown[] }).pending).toHaveLength(1);
    const resumed = await syncTerritory({
      provider,
      territory: "44",
      window: "7d",
      workerId: "w1",
    });
    expect(resumed.status).toBe("success");
    expect(resumed.chunks).toBeGreaterThanOrEqual(1);
    expect((await prisma.syncCheckpoint.findUniqueOrThrow({ where: { id: cp.id } })).status).toBe(
      "SUCCESS",
    );
    // Les territoires en reprise passent avant les jamais synchronisés, puis les plus anciens.
    await prisma.syncCheckpoint.update({ where: { id: cp.id }, data: { status: "PARTIAL" } });
    expect(await staleTerritories(KEY, "7d", ["35", "44", "49"], 3)).toEqual(["44", "35", "49"]);
    await prisma.syncCheckpoint.update({ where: { id: cp.id }, data: { status: "SUCCESS" } });
  });

  it("retire une offre absente de deux listages complets consécutifs, sans toucher aux autres départements", async () => {
    const provider = new FakeNationalProvider(seeds.filter((s) => s.id !== "B"));
    const first = await syncTerritory({ provider, territory: "44", window: "31d", workerId: "w1" });
    expect(first.status).toBe("success");
    expect(first.missed).toBe(1);
    expect(first.removed).toBe(0);
    const source = await prisma.jobSource.findUniqueOrThrow({ where: { key: KEY } });
    const entryB = await prisma.jobSourceEntry.findUniqueOrThrow({
      where: { sourceId_externalId: { sourceId: source.id, externalId: `${PREFIX}B` } },
      include: { job: true },
    });
    expect(entryB.missedListings).toBe(1);
    expect(entryB.status).toBe("UNKNOWN");
    expect(entryB.job.verificationStatus).toBe("UNKNOWN");
    expect(entryB.job.isActive).toBe(true);

    const second = await syncTerritory({
      provider,
      territory: "44",
      window: "31d",
      workerId: "w1",
    });
    expect(second.removed).toBe(1);
    const gone = await prisma.jobSourceEntry.findUniqueOrThrow({
      where: { id: entryB.id },
      include: { job: true },
    });
    expect(gone.status).toBe("REMOVED");
    expect(gone.job.verificationStatus).toBe("REMOVED");
    expect(gone.job.isActive).toBe(false);
    // Conservée en base (historique des favoris et candidatures), simplement retirée des recherches.
    expect(await prisma.job.count({ where: { id: entryB.jobId } })).toBe(1);
    // Une offre qui réapparaît est réactivée.
    const back = await syncTerritory({
      provider: new FakeNationalProvider(seeds),
      territory: "44",
      window: "31d",
      workerId: "w1",
    });
    expect(back.status).toBe("success");
    const revived = await prisma.jobSourceEntry.findUniqueOrThrow({
      where: { id: entryB.id },
      include: { job: true },
    });
    expect(revived.status).toBe("ACTIVE");
    expect(revived.missedListings).toBe(0);
    expect(revived.job.isActive).toBe(true);
  });

  it("enchaîne plusieurs territoires sous budget de temps et agrège le rapport", async () => {
    const provider = new FakeNationalProvider(seeds);
    const report = await runNationalSync({
      provider,
      territories: ["35", "44"],
      window: "31d",
      workerId: "w1",
      maxMinutes: 5,
    });
    expect(report.planned).toBe(2);
    expect(report.synced).toBe(2);
    expect(report.errors).toBe(0);
    expect(report.results.find((r) => r.territory === "35")?.created).toBe(1);
    expect(report.deadlineReached).toBe(false);
  });
});

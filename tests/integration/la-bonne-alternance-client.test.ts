import { describe, expect, it } from "vitest";
import {
  LaBonneAlternanceApiError,
  LaBonneAlternanceClient,
} from "@/services/job-sources/providers/la-bonne-alternance/client";
import { LaBonneAlternanceProvider } from "@/services/job-sources/providers/la-bonne-alternance";
import { QuotaManager } from "@/services/job-sources/quota";
import {
  LBA_OFFER_FIXTURE,
  LBA_OFFER_FRANCE_TRAVAIL,
  LBA_OFFER_PARTNER_MINIMAL,
} from "../fixtures/la-bonne-alternance-offer";

/**
 * Tests d'intégration du client et du provider La bonne alternance contre un serveur simulé (pas de
 * réseau) : clé d'API, 401, 400, 419 / 429 (Retry-After), 5xx, timeouts, recherche géographique bornée
 * (150 par source), export complet découpé par département, exclusion des offres relayées de France
 * Travail, quota manager. Le comportement réel de l'API est validé séparément par `npm run test:lba`.
 */
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    );
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const noSleep = async () => undefined;

function offers(n: number, partner = "offres_emploi_lba", prefix = "lba") {
  return Array.from({ length: n }, (_, i) => ({
    ...LBA_OFFER_FIXTURE,
    identifier: { partner_job_id: `${prefix}-${i}`, id: `${prefix}-${i}`, partner_label: partner },
    offer: { ...LBA_OFFER_FIXTURE.offer, title: `Offre ${prefix} ${i}` },
  }));
}

const EXPORT_URL = "https://storage.example/export.json?X-Amz-Signature=abc";

describe("LaBonneAlternanceClient", () => {
  it("envoie la clé en Bearer et les paramètres de recherche géographique", async () => {
    const { impl, calls } = fakeFetch((url, init) => {
      expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer key-1");
      expect(url.pathname).toBe("/api/job/v1/search");
      return json({ jobs: offers(2), recruiters: [], warnings: [] });
    });
    const client = new LaBonneAlternanceClient({
      apiKey: "key-1",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const res = await client.search({
      latitude: 47.2184,
      longitude: -1.5536,
      radius: 30,
      partnersToExclude: ["France Travail"],
      priority: "live",
    });
    expect(res.jobs).toHaveLength(2);
    const q = calls[0]!.url.searchParams;
    expect(q.get("latitude")).toBe("47.2184");
    expect(q.get("longitude")).toBe("-1.5536");
    expect(q.get("radius")).toBe("30");
    expect(q.getAll("partners_to_exclude")).toEqual(["France Travail"]);
    expect(client.requestCount).toBe(1);
  });

  it("recherche par département (paramètre répété) et borne le rayon", async () => {
    const { impl, calls } = fakeFetch(() => json({ jobs: [], recruiters: [], warnings: [] }));
    const client = new LaBonneAlternanceClient({
      apiKey: "key-1",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    await client.search({ departements: ["44", "49"] });
    expect(calls[0]!.url.searchParams.getAll("departements")).toEqual(["44", "49"]);
    await client.search({ latitude: 1, longitude: 2, radius: 999 });
    expect(calls[1]!.url.searchParams.get("radius")).toBe("200");
  });

  it("explique une clé refusée (401) et une requête invalide (400)", async () => {
    const unauthorized = fakeFetch(() =>
      json({ statusCode: 401, message: "Vous devez fournir une clé d'API valide" }, 401),
    );
    const client = new LaBonneAlternanceClient({
      apiKey: "bad",
      fetchImpl: unauthorized.impl,
      quota: null,
      sleep: noSleep,
    });
    await expect(client.search({})).rejects.toMatchObject({ code: "AUTH", status: 401 });
    await expect(client.search({})).rejects.toThrow(/LA_BONNE_ALTERNANCE_API_KEY/);

    const bad = fakeFetch(() => json({ message: "radius must be <= 200" }, 400));
    const client2 = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: bad.impl,
      quota: null,
      sleep: noSleep,
    });
    await expect(client2.search({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(client2.search({})).rejects.toThrow(/radius must be/);
  });

  it("attend Retry-After sur 419 (code « trop de requêtes » de cette API) puis réessaie", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const { impl } = fakeFetch(() => {
      attempts++;
      return attempts === 1
        ? new Response("slow down", { status: 419, headers: { "retry-after": "3" } })
        : json({ jobs: offers(1), recruiters: [], warnings: [] });
    });
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota: null,
      sleep: async (ms) => void waits.push(ms),
    });
    const res = await client.search({});
    expect(res.jobs).toHaveLength(1);
    expect(waits).toContain(3000);
  });

  it("échoue en RATE_LIMITED après les retries sur 429 et pénalise le quota manager", async () => {
    const { impl } = fakeFetch(() => new Response("", { status: 429 }));
    const quota = new QuotaManager("lba-test", {
      maxPerSecond: 100,
      maxConcurrency: 2,
      sleep: noSleep,
      random: () => 0,
    });
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota,
      sleep: noSleep,
      maxRetries: 1,
    });
    await expect(client.search({})).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(quota.stats().rateLimited).toBeGreaterThanOrEqual(2);
    expect(quota.stats().errors).toBe(1);
  });

  it("réessaie sur 5xx puis expose une erreur SERVER", async () => {
    let attempts = 0;
    const { impl } = fakeFetch(() => {
      attempts++;
      return new Response("boom", { status: 503 });
    });
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
      maxRetries: 1,
    });
    await expect(client.search({})).rejects.toMatchObject({ code: "SERVER", status: 503 });
    expect(attempts).toBe(2);
  });

  it("gère les timeouts avec une erreur TIMEOUT après retries", async () => {
    const impl = (async (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      })) as unknown as typeof fetch;
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
      timeoutMs: 5,
      maxRetries: 1,
    });
    await expect(client.search({})).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("télécharge l'export sans en-tête d'authentification (URL signée)", async () => {
    const { impl, calls } = fakeFetch((url, init) => {
      if (url.pathname === "/api/job/v1/export")
        return json({ url: EXPORT_URL, lastUpdate: "2026-09-10T01:00:00.000Z" });
      expect((init.headers as Record<string, string>)["authorization"]).toBeUndefined();
      return json(offers(3));
    });
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const info = await client.exportInfo();
    expect(info.url).toBe(EXPORT_URL);
    const all = await client.downloadExport(info.url);
    expect(all).toHaveLength(3);
    expect(calls[1]!.url.hostname).toBe("storage.example");
    expect(client.requestCount).toBe(2);
  });

  it("refuse une instanciation sans clé", () => {
    expect(() => new LaBonneAlternanceClient({ apiKey: "" })).toThrow(LaBonneAlternanceApiError);
  });
});

describe("LaBonneAlternanceProvider", () => {
  it("déclare précisément les variables manquantes sans basculer en simulation", async () => {
    const provider = new LaBonneAlternanceProvider({});
    const status = await provider.status();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(["LA_BONNE_ALTERNANCE_API_KEY", "LA_BONNE_ALTERNANCE_KEY_TYPE"]);
    expect(status.reason).toContain("api.apprentissage.beta.gouv.fr/compte/profil");
    await expect(provider.fetchJobs({})).rejects.toThrow(/LA_BONNE_ALTERNANCE_API_KEY/);
  });

  it("refuse d'ingérer avec une clé sandbox (données de test) tout en exposant le client", async () => {
    const provider = new LaBonneAlternanceProvider({ apiKey: "key", keyType: "sandbox" });
    const status = await provider.status();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(["LA_BONNE_ALTERNANCE_KEY_TYPE"]);
    expect(status.reason).toMatch(/sandbox/);
    expect(provider.client()).toBeInstanceOf(LaBonneAlternanceClient);
    await expect(provider.fetchJobs({ department: "44" })).rejects.toMatchObject({ code: "AUTH" });
  });

  it("recherche autour d'une ville, exclut les relais France Travail et signale la borne de 150", async () => {
    const { impl, calls } = fakeFetch(() =>
      json({
        jobs: [
          ...offers(150),
          ...offers(10, "Hellowork", "hw"),
          LBA_OFFER_FRANCE_TRAVAIL,
          { ...LBA_OFFER_FIXTURE, offer: { ...LBA_OFFER_FIXTURE.offer, status: "Filled" } },
          { identifier: { id: "broken" }, offer: "pas un objet" },
        ],
        recruiters: [{ identifier: { id: "r1" } }],
        warnings: [{ code: "ROME", message: "code ignoré" }],
      }),
    );
    const provider = new LaBonneAlternanceProvider({
      apiKey: "key",
      keyType: "production",
      client: { fetchImpl: impl, quota: null, sleep: noSleep },
    });
    const page = await provider.fetchJobs({ city: "Nantes", radiusKm: 25, priority: "live" });
    expect(page.jobs).toHaveLength(160);
    expect(page.total).toBeNull();
    expect(page.truncated).toBe(true);
    expect(page.requests).toBe(1);
    expect(page.warnings).toEqual(
      expect.arrayContaining([
        "ROME : code ignoré",
        expect.stringMatching(/1 offre\(s\) relayée\(s\) de France Travail/),
        expect.stringMatching(/pourvue\(s\) ou annulée\(s\)/),
        expect.stringMatching(/format inattendu/),
        expect.stringMatching(/bornée à 150/),
      ]),
    );
    const q = calls[0]!.url.searchParams;
    expect(q.get("latitude")).toBe("47.2184");
    expect(q.get("radius")).toBe("25");
    expect(q.getAll("partners_to_exclude")).toEqual(["France Travail"]);
    expect(page.jobs.every((j) => j.isAlternance)).toBe(true);
  });

  it("couvre un département depuis l'export complet (une requête + un téléchargement, mis en cache)", async () => {
    const catalogue = [
      ...offers(3), // Nantes (44)
      {
        ...LBA_OFFER_PARTNER_MINIMAL,
        offer: {
          ...LBA_OFFER_PARTNER_MINIMAL.offer,
          description: LBA_OFFER_FIXTURE.offer.description,
        },
      }, // Rennes (35)
      LBA_OFFER_FRANCE_TRAVAIL, // relais France Travail (44) : ignoré
      {
        ...LBA_OFFER_FIXTURE,
        identifier: { id: "sans-adresse", partner_label: "offres_emploi_lba" },
        workplace: {
          ...LBA_OFFER_FIXTURE.workplace,
          location: { address: "Télétravail", geopoint: null },
        },
      },
    ];
    let exports = 0;
    let downloads = 0;
    const { impl } = fakeFetch((url) => {
      if (url.pathname === "/api/job/v1/export") {
        exports++;
        return json({ url: EXPORT_URL, lastUpdate: "2026-09-10T01:00:00.000Z" });
      }
      if (url.hostname === "storage.example") {
        downloads++;
        return json(catalogue);
      }
      throw new Error(`Appel inattendu : ${url}`);
    });
    const provider = new LaBonneAlternanceProvider({
      apiKey: "key",
      keyType: "production",
      client: { fetchImpl: impl, quota: null, sleep: noSleep },
    });
    const first = await provider.fetchJobs({
      department: "44",
      since: new Date(),
      until: new Date(),
    });
    expect(first.jobs.map((j) => j.externalId)).toEqual(["lba-0", "lba-1", "lba-2"]);
    expect(first.total).toBe(3);
    expect(first.truncated).toBe(false);
    expect(first.requests).toBe(2);
    expect(first.warnings).toEqual([
      "1 offre(s) relayée(s) de France Travail ignorée(s) : déjà ingérées à la source.",
    ]);
    const second = await provider.fetchJobs({ department: "35" });
    expect(second.jobs).toHaveLength(1);
    expect(second.jobs[0]!.city).toBe("Rennes");
    expect(second.requests).toBe(0);
    const region = await provider.fetchJobs({ region: "Pays de la Loire" });
    expect(region.jobs).toHaveLength(3);
    const all = await provider.fetchJobs({});
    expect(all.jobs).toHaveLength(5);
    expect(exports).toBe(1);
    expect(downloads).toBe(1);
  });

  it("peut interroger la recherche par département quand le mode « search » est demandé", async () => {
    const { impl, calls } = fakeFetch(() =>
      json({ jobs: offers(2), recruiters: [], warnings: [] }),
    );
    const provider = new LaBonneAlternanceProvider({
      apiKey: "key",
      keyType: "production",
      nationalMode: "search",
      client: { fetchImpl: impl, quota: null, sleep: noSleep },
    });
    const page = await provider.fetchJobs({ department: "44" });
    expect(page.jobs).toHaveLength(2);
    expect(page.total).toBeNull();
    expect(page.truncated).toBe(false);
    expect(calls[0]!.url.searchParams.getAll("departements")).toEqual(["44"]);
  });

  it("passe par le quota manager avec le débit borné de la source", async () => {
    const clock = { now: 1_000_000 };
    const sleeps: number[] = [];
    const quota = new QuotaManager("lba-quota-test", {
      maxPerSecond: 0.5,
      maxConcurrency: 1,
      now: () => clock.now,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock.now += ms;
      },
      random: () => 0,
    });
    const { impl } = fakeFetch(() => json({ jobs: [], recruiters: [], warnings: [] }));
    const client = new LaBonneAlternanceClient({
      apiKey: "key",
      fetchImpl: impl,
      quota,
      sleep: noSleep,
      now: () => clock.now,
    });
    await client.search({ departements: ["44"] });
    await client.search({ departements: ["49"] });
    // Deuxième appel : un jeton se régénère en 2 s à 0,5 / s.
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2000);
    expect(quota.stats().acquired).toBe(2);
  });
});

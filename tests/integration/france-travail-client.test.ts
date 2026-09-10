import { describe, expect, it } from "vitest";
import {
  FranceTravailApiError,
  FranceTravailClient,
  parseContentRange,
} from "@/services/job-sources/providers/france-travail/client";
import { FranceTravailProvider } from "@/services/job-sources/providers/france-travail";
import { FT_OFFER_FIXTURE } from "../fixtures/france-travail-offer";

/**
 * Tests d'intégration du client HTTP contre un serveur France Travail simulé (pas de réseau) :
 * authentification, renouvellement de jeton, pagination `range`/Content-Range, 204, 400, 401, 429, 5xx, timeouts.
 * Le comportement réel de l'API est validé séparément par `npm run test:france-travail`.
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
const tokenResponse = () => json({ access_token: "tok-1", token_type: "Bearer", expires_in: 1499 });

function makeOffers(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    ...FT_OFFER_FIXTURE,
    id: `OFF${offset + i}`,
    intitule: `Offre ${offset + i}`,
  }));
}

const noSleep = async () => undefined;

describe("FranceTravailClient", () => {
  it("s'authentifie puis interroge la recherche avec le jeton", async () => {
    const { impl, calls } = fakeFetch((url, init) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok-1");
      return json({ resultats: makeOffers(2) }, 200);
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const page = await client.search({ motsCles: "developpeur", commune: "44109", distance: 30 });
    expect(page.status).toBe(200);
    expect(page.resultats).toHaveLength(2);
    const search = calls[1]!.url;
    expect(search.searchParams.get("commune")).toBe("44109");
    expect(search.searchParams.get("distance")).toBe("30");
    expect(search.searchParams.get("range")).toBe("0-149");
    const auth = calls[0]!;
    expect(String(auth.init.body)).toContain("grant_type=client_credentials");
    expect(String(auth.init.body)).toContain("scope=api_offresdemploiv2+o2dsoffre");
  });

  it("pagine avec range / Content-Range jusqu'au total annoncé", async () => {
    const total = 320;
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      const [start, end] = url.searchParams.get("range")!.split("-").map(Number) as [
        number,
        number,
      ];
      const count = Math.max(0, Math.min(end, total - 1) - start + 1);
      const last = start + count >= total;
      return json({ resultats: makeOffers(count, start) }, last ? 200 : 206, {
        "content-range": `offres ${start}-${start + count - 1}/${total}`,
      });
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const all = await client.searchAll({ motsCles: "dev" }, { maxResults: 1000 });
    expect(all.offers).toHaveLength(total);
    expect(all.total).toBe(total);
    expect(all.requests).toBe(3);
    expect(all.truncated).toBe(false);
    expect(
      calls
        .filter((c) => c.url.pathname.endsWith("/offres/search"))
        .map((c) => c.url.searchParams.get("range")),
    ).toEqual(["0-149", "150-299", "300-449"]);
  });

  it("signale une troncature quand le total dépasse la limite demandée", async () => {
    const { impl } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      const [start] = url.searchParams.get("range")!.split("-").map(Number) as [number, number];
      return json({ resultats: makeOffers(150, start) }, 206, {
        "content-range": `offres ${start}-${start + 149}/2000`,
      });
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const all = await client.searchAll({ motsCles: "dev" }, { maxResults: 300 });
    expect(all.offers).toHaveLength(300);
    expect(all.truncated).toBe(true);
    expect(all.warnings[0]).toMatch(/tronqués/);
  });

  it("retourne une page vide sur 204", async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname.includes("access_token") ? tokenResponse() : new Response(null, { status: 204 }),
    );
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const all = await client.searchAll({ motsCles: "xyz" });
    expect(all.offers).toHaveLength(0);
    expect(all.requests).toBe(1);
  });

  it("renouvelle le jeton une fois sur 401", async () => {
    let tokens = 0;
    let searches = 0;
    const { impl } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) {
        tokens++;
        return json({ access_token: `tok-${tokens}`, expires_in: 1499 });
      }
      searches++;
      return searches === 1
        ? new Response("expired", { status: 401 })
        : json({ resultats: makeOffers(1) });
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const page = await client.search({ motsCles: "dev" });
    expect(page.resultats).toHaveLength(1);
    expect(tokens).toBe(2);
  });

  it("attend Retry-After sur 429 puis réessaie", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const { impl } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      attempts++;
      return attempts === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "2" } })
        : json({ resultats: makeOffers(1) });
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: async (ms) => void waits.push(ms),
    });
    const page = await client.search({ motsCles: "dev" });
    expect(page.resultats).toHaveLength(1);
    expect(waits).toContain(2000);
  });

  it("échoue proprement après les retries sur 5xx et expose une erreur typée sur 400", async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname.includes("access_token")
        ? tokenResponse()
        : new Response("boom", { status: 503 }),
    );
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
      maxRetries: 1,
    });
    await expect(client.search({ motsCles: "dev" })).rejects.toMatchObject({
      code: "SERVER",
      status: 503,
    });

    const bad = fakeFetch((url) =>
      url.pathname.includes("access_token")
        ? tokenResponse()
        : json({ message: "Le paramètre commune est invalide" }, 400),
    );
    const client2 = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: bad.impl,
      quota: null,
      sleep: noSleep,
    });
    await expect(client2.search({ commune: "44000" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(client2.search({ commune: "44000" })).rejects.toThrow(/commune est invalide/);
  });

  it("explique une authentification refusée", async () => {
    const { impl } = fakeFetch(() =>
      json({ error: "invalid_client", error_description: "Client authentication failed" }, 400),
    );
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "wrong",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    await expect(client.getAccessToken()).rejects.toMatchObject({ code: "AUTH" });
    await expect(client.getAccessToken()).rejects.toThrow(/Client authentication failed/);
  });

  it("gère les timeouts avec une erreur TIMEOUT après retries", async () => {
    const impl = (async (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      })) as unknown as typeof fetch;
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
      timeoutMs: 5,
      maxRetries: 1,
    });
    await expect(client.getAccessToken()).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("refuse une instanciation sans identifiants", () => {
    expect(() => new FranceTravailClient({ clientId: "", clientSecret: "" })).toThrow(
      FranceTravailApiError,
    );
  });

  it("retourne null pour une offre retirée (404)", async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname.includes("access_token")
        ? tokenResponse()
        : new Response("not found", { status: 404 }),
    );
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    expect(await client.getOffer("GONE")).toBeNull();
  });

  it("parse l'en-tête Content-Range", () => {
    expect(parseContentRange("offres 0-149/2345")).toEqual({ start: 0, end: 149, total: 2345 });
    expect(parseContentRange("offres 150-299/*")).toEqual({ start: 150, end: 299, total: null });
    expect(parseContentRange(null)).toBeNull();
  });
});

describe("FranceTravailProvider", () => {
  it("déclare précisément les variables manquantes sans basculer en simulation", async () => {
    const provider = new FranceTravailProvider({});
    const status = await provider.status();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(["FRANCE_TRAVAIL_CLIENT_ID", "FRANCE_TRAVAIL_CLIENT_SECRET"]);
    await expect(provider.fetchJobs({})).rejects.toThrow(/FRANCE_TRAVAIL_CLIENT_ID/);
  });

  it("résout la commune, applique le rayon et filtre les natures de contrat alternance", async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      if (url.pathname.endsWith("/referentiel/naturesContrats"))
        return json([
          { code: "E1", libelle: "Contrat travail" },
          { code: "E2", libelle: "Contrat apprentissage" },
          { code: "FS", libelle: "Contrat de professionnalisation" },
        ]);
      return json(
        { resultats: [FT_OFFER_FIXTURE, { ...FT_OFFER_FIXTURE, id: "BAD", intitule: null }] },
        200,
      );
    });
    const provider = new FranceTravailProvider({
      clientId: "id",
      clientSecret: "secret",
      client: { fetchImpl: impl, quota: null, sleep: noSleep },
    });
    const page = await provider.fetchJobs({
      keywords: "développeur",
      city: "Nantes",
      radiusKm: 30,
    });
    expect(page.jobs).toHaveLength(2);
    const search = calls.find((c) => c.url.pathname.endsWith("/offres/search"))!.url;
    expect(search.searchParams.get("commune")).toBe("44109");
    expect(search.searchParams.get("distance")).toBe("30");
    expect(search.searchParams.get("natureContrat")).toBe("E2,FS");
    expect(search.searchParams.get("motsCles")).toBe("développeur");
  });

  it("vérifie l'existence des offres (ACTIVE / REMOVED)", async () => {
    const { impl } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      return url.pathname.endsWith("/offres/195ABCD")
        ? json(FT_OFFER_FIXTURE)
        : new Response(null, { status: 404 });
    });
    const provider = new FranceTravailProvider({
      clientId: "id",
      clientSecret: "secret",
      client: { fetchImpl: impl, quota: null, sleep: noSleep },
    });
    const results = await provider.verifyJobs!(["195ABCD", "GONE"]);
    expect(results.map((r) => r.status)).toEqual(["ACTIVE", "REMOVED"]);
    expect(results[0]!.job?.title).toContain("Développeur web");
  });
});

describe("FranceTravailClient — arrêt anticipé", () => {
  it("s'arrête après la première page quand le total annoncé dépasse la borne et que l'appelant découpera", async () => {
    const total = 5000;
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.includes("access_token")) return tokenResponse();
      const [start, end] = url.searchParams.get("range")!.split("-").map(Number) as [
        number,
        number,
      ];
      return json({ resultats: makeOffers(end - start + 1, start) }, 206, {
        "content-range": `offres ${start}-${end}/${total}`,
      });
    });
    const client = new FranceTravailClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: impl,
      quota: null,
      sleep: noSleep,
    });
    const result = await client.searchAll(
      { departement: "75" },
      { maxResults: 3150, stopIfTruncated: true },
    );
    expect(result.offers).toHaveLength(0);
    expect(result.total).toBe(total);
    expect(result.truncated).toBe(true);
    expect(result.requests).toBe(1);
    expect(calls.filter((c) => c.url.pathname.includes("/offres/search"))).toHaveLength(1);
    // Sans l'option : pagination jusqu'à la borne.
    const full = await client.searchAll({ departement: "75" }, { maxResults: 300 });
    expect(full.offers).toHaveLength(300);
    expect(full.truncated).toBe(true);
  });
});

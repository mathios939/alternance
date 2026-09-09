/**
 * TEST EXTERNE — API France Travail « Offres d'emploi v2 » en conditions réelles.
 *
 *   npm run test:france-travail -- --q developpeur --city Nantes --radius 30 --limit 20 [--store]
 *
 * Étapes : configuration → authentification → référentiels (codes alternance, codes INSEE) →
 * recherche paginée (≤ 50 offres, quelques requêtes) → validation & normalisation →
 * vérification d'existence (2 offres). Avec `--store` (base locale requise) : stockage puis
 * seconde exécution pour prouver le dédoublonnage. Sans identifiants : NOT_CONFIGURED (code 2).
 * Rien n'est simulé ; les descriptions ne sont jamais affichées.
 */
import { num, parseArgs, str } from "../../scripts/lib/bootstrap";
import { envValue, notConfigured, runExternalTest } from "./lib/harness";

void runExternalTest("France Travail", "france-travail", async (ctx) => {
  const args = parseArgs();
  const q = str(args["q"]) ?? "développeur";
  const city = str(args["city"]) ?? "Nantes";
  const radius = num(args["radius"]) ?? 30;
  const limit = Math.min(num(args["limit"]) ?? 20, 50);
  const store = args["store"] === true;
  ctx.detail("provider", "france-travail");
  ctx.detail("query", `${q} · ${city} · ${radius} km · ${limit} max`);

  const clientId = envValue("FRANCE_TRAVAIL_CLIENT_ID");
  const clientSecret = envValue("FRANCE_TRAVAIL_CLIENT_SECRET");
  await ctx.step("Configuration", async () => {
    const missing = [!clientId && "FRANCE_TRAVAIL_CLIENT_ID", !clientSecret && "FRANCE_TRAVAIL_CLIENT_SECRET"].filter(Boolean) as string[];
    if (missing.length) notConfigured(`Variables manquantes : ${missing.join(", ")} (compte partenaire sur https://francetravail.io, API « Offres d'emploi v2 »)`);
    return "identifiants présents (valeurs masquées)";
  });

  const { FranceTravailProvider } = await import("../../src/services/job-sources/providers/france-travail");
  const { validateRawJob } = await import("../../src/services/ingestion/validate");
  const { normalizeJob } = await import("../../src/services/job-sources/normalize");
  const provider = new FranceTravailProvider({ clientId, clientSecret, client: { timeoutMs: 15_000, maxRetries: 1 } });
  const client = provider.client();

  await ctx.step("Authentification OAuth2 (client_credentials)", async () => {
    const t0 = Date.now();
    const token = await client.getAccessToken();
    ctx.detail("authLatencyMs", Date.now() - t0);
    return `jeton obtenu (${token.length} caractères, non affiché)`;
  });

  await ctx.step("Référentiel naturesContrats", async () => {
    const codes = await provider.alternanceNatureCodes();
    ctx.detail("alternanceCodes", codes.join(","));
    return `codes alternance : ${codes.join(", ")}`;
  });

  await ctx.step("Référentiel communes (codes INSEE statiques)", async () => {
    const mismatches = await provider.communes().checkStaticCodes();
    ctx.detail("inseeMismatches", mismatches.length);
    if (mismatches.length) ctx.warn(`${mismatches.length} code(s) INSEE à corriger dans src/config/cities.ts : ${mismatches.map((m) => `${m.city} (${m.expected} → ${m.found ?? "?"})`).join(", ")}`);
    const commune = await provider.communes().resolve(city);
    if (!commune) throw new Error(`Commune « ${city} » introuvable dans le référentiel`);
    return `« ${city} » → ${commune.inseeCode} (${commune.via})`;
  });

  let page: Awaited<ReturnType<typeof provider.fetchJobs>> | null = null;
  await ctx.step(`Recherche « ${q} » à ${city} (${radius} km)`, async () => {
    const t0 = Date.now();
    page = await provider.fetchJobs({ keywords: q, city, radiusKm: radius, limit });
    ctx.detail("latencyMs", Date.now() - t0);
    ctx.detail("count", page.jobs.length);
    ctx.detail("total", page.total);
    ctx.detail("requests", page.requests);
    for (const w of page.warnings) ctx.warn(w);
    for (const j of page.jobs.slice(0, 5)) ctx.info(`${j.externalId} · ${j.title.slice(0, 70)} · ${j.companyName ?? "employeur non communiqué"} · ${j.city ?? "?"} · ${j.publishedAt.toISOString().slice(0, 10)}`);
    if (page.jobs.length === 0) ctx.warn("Aucune offre : élargis les mots-clés ou le rayon avant de conclure à un problème.");
    return `${page.jobs.length} offre(s) sur ${page.total ?? "?"} annoncée(s), ${page.requests} requête(s)`;
  });

  await ctx.step("Validation et normalisation", async () => {
    const jobs = page?.jobs ?? [];
    const rejected: Record<string, number> = {};
    let accepted = 0;
    for (const raw of jobs) {
      const v = validateRawJob(raw);
      if (!v.ok) rejected[v.code] = (rejected[v.code] ?? 0) + 1;
      else accepted++;
    }
    ctx.detail("normalized", accepted);
    ctx.detail("rejected", jobs.length - accepted);
    const sample = jobs.find((j) => validateRawJob(j).ok);
    if (sample) {
      const job = normalizeJob(sample, { key: provider.key, type: provider.type, isDemo: false });
      ctx.info(`Exemple : « ${job.title.slice(0, 60)} » → ${job.jobFamily}, ${job.city} (${job.department ?? "?"}), niveau ${job.educationLevelMin ?? "?"}–${job.educationLevelMax ?? "?"}, ${job.durationMonths ?? "?"} mois, ${job.skillSlugs.length} compétence(s), URL candidature ${job.applicationUrl ? "présente" : "absente"}`);
    }
    return `${accepted} acceptée(s), ${jobs.length - accepted} rejetée(s)${Object.keys(rejected).length ? ` (${Object.entries(rejected).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`;
  });

  await ctx.step("Vérification d'existence (endpoint détail, 2 offres)", async () => {
    const ids = (page?.jobs ?? []).slice(0, 2).map((j) => j.externalId);
    if (ids.length === 0) return "aucune offre à vérifier";
    const results = await provider.verifyJobs(ids);
    const unknown = results.filter((r) => r.status === "UNKNOWN");
    if (unknown.length === results.length) throw new Error(`Détail indisponible : ${unknown[0]?.error ?? "?"}`);
    return results.map((r) => `${r.externalId}=${r.status}`).join(", ");
  });

  if (store) {
    const { runIngestion } = await import("../../src/services/ingestion");
    await ctx.step("Stockage (pipeline complet, base locale)", async () => {
      const first = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, trigger: "test" });
      if (first.errors.length && first.fetched === 0) throw new Error(first.errors[0]);
      ctx.detail("inserted", first.created);
      return `${first.fetched} récupérées, ${first.created} créées, ${first.updated} mises à jour, ${first.duplicates} rattachées, ${first.rejected} rejetées (run ${first.runId})`;
    });
    await ctx.step("Dédoublonnage (seconde exécution identique)", async () => {
      const second = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, trigger: "test" });
      if (second.created > 0) throw new Error(`${second.created} offre(s) recréée(s) : dédoublonnage par identifiant externe en échec`);
      return `0 création, ${second.updated} mise(s) à jour`;
    });
    const { disconnectPrisma } = await import("../../scripts/lib/bootstrap");
    await disconnectPrisma();
  } else {
    ctx.info("Stockage et dédoublonnage non exécutés (ajoute --store avec une base locale, ou lance le workflow « Real data smoke test »).");
  }
});

/**
 * TEST EXTERNE — API France Travail en conditions réelles (réseau + identifiants requis).
 *
 *   npm run test:france-travail -- --q developpeur --city Nantes --radius 30 --limit 50 [--dry-run]
 *
 * Vérifie, dans l'ordre : configuration → authentification → référentiels (codes alternance,
 * codes INSEE) → recherche (pagination) → validation & normalisation → stockage → dédoublonnage
 * (seconde exécution) → vérification d'existence. Sans identifiants : échec explicite (code 2).
 */
import { c, disconnectPrisma, EXIT, fail, heading, info, missingEnv, num, ok, parseArgs, runMain, str, warn } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const q = str(args["q"]) ?? "développeur";
  const city = str(args["city"]) ?? "Nantes";
  const radius = num(args["radius"]) ?? 30;
  const limit = num(args["limit"]) ?? 50;
  const dryRun = args["dry-run"] === true;

  heading("1. Configuration");
  const missing = missingEnv(["FRANCE_TRAVAIL_CLIENT_ID", "FRANCE_TRAVAIL_CLIENT_SECRET"]);
  if (missing.length) {
    fail(`Variables manquantes : ${missing.join(", ")}`);
    info("Créer un compte sur https://francetravail.io, déclarer une application, souscrire à l'API « Offres d'emploi v2 »,");
    info("puis copier l'identifiant client et la clé secrète dans .env (jamais dans le code ni côté client).");
    return EXIT.NOT_CONFIGURED;
  }
  ok("FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET présents");

  const { FranceTravailProvider, FranceTravailApiError } = await import("../src/services/job-sources/providers/france-travail");
  const { validateRawJob } = await import("../src/services/ingestion/validate");
  const { normalizeJob } = await import("../src/services/job-sources/normalize");
  const provider = new FranceTravailProvider({ clientId: process.env["FRANCE_TRAVAIL_CLIENT_ID"], clientSecret: process.env["FRANCE_TRAVAIL_CLIENT_SECRET"] });
  const client = provider.client();

  heading("2. Authentification OAuth2 (client_credentials)");
  try {
    const t0 = Date.now();
    const token = await client.getAccessToken();
    ok(`Jeton obtenu en ${Date.now() - t0} ms (${token.length} caractères, non affiché)`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    if (error instanceof FranceTravailApiError && error.code === "AUTH") info("Vérifie que l'application est bien abonnée à l'API Offres d'emploi v2 et que le secret n'a pas expiré.");
    return EXIT.FAILED;
  }

  heading("3. Référentiels");
  const codes = await provider.alternanceNatureCodes();
  ok(`Codes nature de contrat alternance : ${codes.join(", ")}`);
  const mismatches = await provider.communes().checkStaticCodes();
  if (mismatches.length === 0) ok("Codes INSEE statiques conformes au référentiel communes");
  else {
    warn(`${mismatches.length} code(s) INSEE à corriger dans src/config/cities.ts :`);
    for (const m of mismatches) info(`${m.city} : attendu ${m.expected}, référentiel ${m.found ?? "introuvable"}`);
  }
  const commune = await provider.communes().resolve(city);
  if (!commune) {
    fail(`Commune « ${city} » introuvable`);
    return EXIT.FAILED;
  }
  ok(`« ${city} » → code INSEE ${commune.inseeCode} (${commune.via})`);

  heading(`4. Recherche « ${q} » à ${city} (${radius} km), ${limit} résultats max`);
  const t1 = Date.now();
  const page = await provider.fetchJobs({ keywords: q, city, radiusKm: radius, limit });
  ok(`${page.jobs.length} offre(s) récupérée(s) sur ${page.total ?? "?"} annoncée(s), ${page.requests} requête(s), ${Date.now() - t1} ms`);
  for (const w of page.warnings) warn(w);
  for (const j of page.jobs.slice(0, 5)) info(`${j.externalId} · ${j.title} · ${j.companyName ?? c.dim("employeur non communiqué")} · ${j.city ?? "?"} · publiée ${j.publishedAt.toISOString().slice(0, 10)}`);
  if (page.jobs.length === 0) warn("Aucune offre : élargis la recherche (mots-clés, rayon) avant de conclure à un problème.");

  heading("5. Validation et normalisation");
  const rejected: Record<string, number> = {};
  let accepted = 0;
  for (const raw of page.jobs) {
    const v = validateRawJob(raw);
    if (!v.ok) {
      rejected[v.code] = (rejected[v.code] ?? 0) + 1;
      continue;
    }
    accepted++;
  }
  ok(`${accepted} acceptée(s), ${page.jobs.length - accepted} rejetée(s) ${Object.keys(rejected).length ? `(${Object.entries(rejected).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`);
  const sample = page.jobs.find((j) => validateRawJob(j).ok);
  if (sample) {
    const job = normalizeJob(sample, { key: provider.key, type: provider.type, isDemo: false });
    info(`Exemple normalisé : « ${job.title} » → famille ${job.jobFamily}, ${job.city} (${job.department ?? "?"}), niveau ${job.educationLevelMin ?? "?"}–${job.educationLevelMax ?? "?"}, ${job.durationMonths ?? "?"} mois, salaire ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"} ${job.salaryPeriod ?? ""}, ${job.skillSlugs.length} compétence(s), candidature ${job.applicationUrl}`);
  }

  if (dryRun) {
    heading("6-7. Stockage et dédoublonnage ignorés (--dry-run)");
  } else {
    const { runIngestion } = await import("../src/services/ingestion");
    heading("6. Stockage (pipeline complet)");
    const first = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, trigger: "test" });
    ok(`run ${first.runId} : ${first.fetched} récupérées, ${first.created} créées, ${first.updated} mises à jour, ${first.duplicates} rattachées, ${first.rejected} rejetées, ${first.failed} en erreur, ${first.durationMs} ms`);
    for (const w of first.warnings) warn(w);
    for (const e of first.errors.slice(0, 5)) fail(e);

    heading("7. Dédoublonnage (seconde exécution identique)");
    const second = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, trigger: "test" });
    if (second.created === 0) ok(`Aucune création : ${second.updated} mise(s) à jour, ${second.duplicates} rattachement(s)`);
    else fail(`${second.created} offre(s) recréée(s) : le dédoublonnage par identifiant externe a échoué`);
  }

  heading("8. Vérification d'existence (endpoint détail)");
  const ids = page.jobs.slice(0, 3).map((j) => j.externalId);
  if (ids.length) {
    const results = await provider.verifyJobs(ids);
    for (const r of results) (r.status === "ACTIVE" ? ok : r.status === "REMOVED" ? warn : fail)(`${r.externalId} : ${r.status}${r.error ? ` (${r.error})` : ""}`);
  } else info("Aucune offre à vérifier");

  await disconnectPrisma();
  heading("Résultat");
  ok("France Travail fonctionne de bout en bout avec ces identifiants.");
  return EXIT.OK;
});

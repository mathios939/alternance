/**
 * SMOKE TEST DONNÉES RÉELLES — France Travail → normalisation → dédoublonnage → base de test →
 * Match Score → rapport qualité. Réseau, identifiants France Travail et une base PostgreSQL
 * JETABLE requis (jamais la production).
 *
 *   npm run smoke:real-data -- --q développeur --city Nantes --radius 30 --limit 30
 *
 * Garde-fou : DATABASE_URL doit pointer vers localhost / 127.0.0.1, sauf SMOKE_ALLOW_REMOTE_DB=1.
 * Au plus 50 offres, quelques requêtes. Les descriptions ne sont jamais affichées.
 */
import { num, parseArgs, str } from "../../scripts/lib/bootstrap";
import { envValue, isHttpUrl, notConfigured, runExternalTest } from "./lib/harness";

void runExternalTest("Smoke test données réelles", "real-data-smoke", async (ctx) => {
  const args = parseArgs();
  const q = str(args["q"]) ?? "développeur";
  const city = str(args["city"]) ?? "Nantes";
  const radius = num(args["radius"]) ?? 30;
  const limit = Math.max(1, Math.min(num(args["limit"]) ?? 30, 50));
  ctx.detail("provider", "france-travail");
  ctx.detail("query", `${q} · ${city} · ${radius} km · ${limit} max`);

  await ctx.step("Garde-fou base de données (jamais la production)", async () => {
    const url = envValue("DATABASE_URL");
    if (!url) notConfigured("DATABASE_URL absente : ce smoke test a besoin d'une base PostgreSQL jetable");
    const host = new URL(url).hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!local && envValue("SMOKE_ALLOW_REMOTE_DB") !== "1") {
      throw Object.assign(new Error(`DATABASE_URL pointe vers « ${host} » : refusé (base non locale). Utilise une base jetable ou SMOKE_ALLOW_REMOTE_DB=1 en connaissance de cause.`), { code: "GUARD" });
    }
    ctx.detail("database", `${host} (${local ? "locale" : "distante autorisée explicitement"})`);
    return `${host} (${new URL(url).pathname.replace("/", "") || "?"})`;
  });

  const clientId = envValue("FRANCE_TRAVAIL_CLIENT_ID");
  const clientSecret = envValue("FRANCE_TRAVAIL_CLIENT_SECRET");
  await ctx.step("Configuration France Travail", async () => {
    const missing = [!clientId && "FRANCE_TRAVAIL_CLIENT_ID", !clientSecret && "FRANCE_TRAVAIL_CLIENT_SECRET"].filter(Boolean) as string[];
    if (missing.length) notConfigured(`Variables manquantes : ${missing.join(", ")}`);
    return "identifiants présents (valeurs masquées)";
  });

  const { FranceTravailProvider } = await import("../../src/services/job-sources/providers/france-travail");
  const { validateRawJob } = await import("../../src/services/ingestion/validate");
  const { normalizeJob } = await import("../../src/services/job-sources/normalize");
  const { calculateMatchScore } = await import("../../src/lib/matching/match-score");
  const { runIngestion } = await import("../../src/services/ingestion");
  const { qualityLabel } = await import("../../src/services/ingestion/quality");
  const { prisma } = await import("../../src/lib/db");
  const { findCity } = await import("../../src/config/cities");
  const provider = new FranceTravailProvider({ clientId, clientSecret, client: { timeoutMs: 15_000, maxRetries: 1 } });

  // 1. FETCH
  let page: Awaited<ReturnType<typeof provider.fetchJobs>> = { jobs: [], total: null, requests: 0, warnings: [] };
  await ctx.step(`Fetch France Travail « ${q} » à ${city} (${radius} km, ${limit} max)`, async () => {
    const t0 = Date.now();
    page = await provider.fetchJobs({ keywords: q, city, radiusKm: radius, limit });
    ctx.detail("latencyMs", Date.now() - t0);
    ctx.detail("Fetched", page.jobs.length);
    ctx.detail("requests", page.requests);
    for (const w of page.warnings) ctx.warn(w);
    if (page.jobs.length === 0) ctx.warn("Aucune offre renvoyée : le reste du rapport sera vide.");
    return `${page.jobs.length} offre(s) sur ${page.total ?? "?"} annoncée(s), ${page.requests} requête(s)`;
  });

  // 2. VALIDATION / NORMALISATION
  const normalized: Array<ReturnType<typeof normalizeJob>> = [];
  const rejected: Record<string, number> = {};
  let missingLocation = 0;
  let missingApplicationUrl = 0;
  let missingDescription = 0;
  let validUrls = 0;
  await ctx.step("Normalisation et contrôle des champs", async () => {
    for (const raw of page.jobs) {
      if (!raw.city?.trim() && !raw.postalCode && (typeof raw.latitude !== "number" || typeof raw.longitude !== "number")) missingLocation++;
      if (!raw.applicationUrl) missingApplicationUrl++;
      if (!raw.description || raw.description.trim().length < 40) missingDescription++;
      if (isHttpUrl(raw.applicationUrl) && isHttpUrl(raw.sourceUrl)) validUrls++;
      const v = validateRawJob(raw);
      if (!v.ok) {
        rejected[v.code] = (rejected[v.code] ?? 0) + 1;
        continue;
      }
      normalized.push(normalizeJob(raw, { key: provider.key, type: provider.type, isDemo: false }));
    }
    const rejectedCount = page.jobs.length - normalized.length;
    ctx.detail("Normalized", normalized.length);
    ctx.detail("Rejected", rejectedCount);
    ctx.detail("Missing location", missingLocation);
    ctx.detail("Missing application URL", missingApplicationUrl);
    ctx.detail("Missing description", missingDescription);
    ctx.detail("External URLs valid format", `${validUrls}/${page.jobs.length}`);
    for (const j of normalized.slice(0, 5)) ctx.info(`${j.externalId} · ${j.title.slice(0, 60)} · ${j.companyNameRaw ?? "employeur non communiqué"} · ${j.city} · qualité ${j.applicationUrl ? "URL ok" : "sans URL"}`);
    return `${normalized.length} normalisée(s), ${rejectedCount} rejetée(s)${Object.keys(rejected).length ? ` (${Object.entries(rejected).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`;
  });

  // 3. BASE DE TEST (pipeline complet, dédoublonnage inclus)
  let report: Awaited<ReturnType<typeof runIngestion>> | null = null;
  await ctx.step("Ingestion dans la base de test (validation → dédoublonnage → enrichissement)", async () => {
    report = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, maxJobs: limit, trigger: "smoke" });
    if (report.errors.length && report.fetched === 0) throw new Error(report.errors[0]);
    ctx.detail("Inserted", report.created);
    ctx.detail("Updated", report.updated);
    ctx.detail("Duplicates", report.duplicates);
    ctx.detail("Ingestion failed", report.failed);
    for (const w of report.warnings) ctx.warn(w);
    return `${report.created} insérée(s), ${report.updated} mise(s) à jour, ${report.duplicates} doublon(s), ${report.rejected} rejetée(s), ${report.failed} erreur(s) (run ${report.runId})`;
  });

  await ctx.step("Dédoublonnage (seconde passe sur les mêmes offres)", async () => {
    const second = await runIngestion({ provider, params: { keywords: q, city, radiusKm: radius, limit }, maxJobs: limit, trigger: "smoke" });
    if (second.created > 0) throw new Error(`${second.created} offre(s) recréée(s) : le dédoublonnage par identifiant externe a échoué`);
    return `0 création, ${second.updated} mise(s) à jour, ${second.duplicates} rattachement(s)`;
  });

  // 4. ENTREPRISES + QUALITÉ (lecture en base)
  const ids = page.jobs.map((j) => j.externalId);
  const entries = await prisma.jobSourceEntry.findMany({ where: { source: { key: provider.key }, externalId: { in: ids } }, include: { job: { include: { company: { select: { isPlaceholder: true, dataOrigin: true } }, skills: { include: { skill: { select: { slug: true } } } } } } } });
  await ctx.step("Rapprochement entreprises et qualité des données", async () => {
    const matched = entries.filter((e) => !e.job.company.isPlaceholder).length;
    const anonymous = entries.length - matched;
    const scores = entries.map((e) => e.job.dataQualityScore).filter((s): s is number => s !== null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const labels: Record<string, number> = {};
    for (const s of scores) {
      const l = qualityLabel(s) ?? "?";
      labels[l] = (labels[l] ?? 0) + 1;
    }
    ctx.detail("Companies matched", `${matched}/${entries.length}`);
    ctx.detail("Employer not disclosed", anonymous);
    ctx.detail("Data quality avg", avg);
    ctx.detail("Data quality labels", Object.entries(labels).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—");
    return `${matched} entreprise(s) identifiée(s), ${anonymous} employeur(s) non communiqué(s), qualité moyenne ${avg ?? "?"}/100`;
  });

  // 5. MATCH SCORE (candidat synthétique, aucune donnée utilisateur)
  await ctx.step("Match Score (candidat synthétique BAC+2 développeur, Nantes, 30 km)", async () => {
    const home = findCity(city);
    const candidate = {
      educationLevel: "BAC2" as const,
      jobFamily: "dev",
      targetJobTitle: "Développeur web",
      skills: ["react", "node-js", "javascript", "sql", "git"],
      latitude: home?.lat ?? null,
      longitude: home?.lng ?? null,
      city: home?.name ?? city,
      department: home?.department ?? null,
      region: home?.region ?? null,
      maxRadiusKm: radius,
      mobility: "DEPARTMENT" as const,
      hasDrivingLicense: true,
      hasVehicle: false,
      remotePreference: "HYBRID" as const,
      rhythm: null,
      durationMonths: 24,
      startDate: null,
      contractTypes: [],
      sectors: ["tech"],
      experienceMonths: 6,
      experienceKeywords: ["web", "react"],
    };
    const totals: number[] = [];
    const levels: Record<string, number> = {};
    let unknownCriteria = 0;
    for (const e of entries) {
      const j = e.job;
      const result = calculateMatchScore(candidate, {
        id: j.id,
        title: j.title,
        jobFamily: j.jobFamily,
        sector: j.sector,
        skills: j.skills.map((s) => s.skill.slug),
        requiredSkills: j.skills.filter((s) => s.required).map((s) => s.skill.slug),
        educationLevelMin: j.educationLevelMin,
        educationLevelMax: j.educationLevelMax,
        latitude: j.latitude,
        longitude: j.longitude,
        city: j.city,
        department: j.department,
        region: j.region,
        remote: j.remote,
        rhythm: j.rhythm,
        durationMonths: j.durationMonths,
        startDate: j.startDate,
        contractType: j.contractType,
        publishedAt: j.publishedAt,
      });
      totals.push(result.total);
      levels[result.level] = (levels[result.level] ?? 0) + 1;
      unknownCriteria += result.unknownCriteria.length;
    }
    const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
    ctx.detail("Match Score calculated", totals.length);
    ctx.detail("Match Score avg", avg);
    ctx.detail("Match Score levels", Object.entries(levels).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—");
    ctx.detail("Unknown criteria (total)", unknownCriteria);
    if (totals.some((t) => !Number.isFinite(t) || t < 0 || t > 100)) throw new Error("Match Score hors bornes");
    return `${totals.length} score(s), moyenne ${avg ?? "?"}/100`;
  });

  await prisma.$disconnect();
});

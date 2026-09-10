/**
 * TEST EXTERNE — API Alternance (La bonne alternance, Ministère du Travail) en conditions réelles.
 *
 *   npm run test:lba -- --city Nantes --radius 30 --department 44 [--export]
 *
 * Étapes : configuration → healthcheck authentifié → recherche autour d'une ville (150 offres max par
 * source, relais France Travail exclus) → recherche par département → validation & normalisation →
 * export complet (avec `--export` : une requête + un téléchargement, 2 appels / min autorisés).
 * Sans clé : NOT_CONFIGURED (code 2). Une clé « sandbox » renvoie des données de test : le test le
 * signale et l'ingestion reste désactivée tant que LA_BONNE_ALTERNANCE_KEY_TYPE ≠ production.
 * Rien n'est simulé ; les descriptions ne sont jamais affichées.
 */
import { num, parseArgs, str } from "../../scripts/lib/bootstrap";
import { envValue, notConfigured, runExternalTest } from "./lib/harness";

void runExternalTest("La bonne alternance", "la-bonne-alternance", async (ctx) => {
  const args = parseArgs();
  const city = str(args["city"]) ?? "Nantes";
  const radius = num(args["radius"]) ?? 30;
  const department = str(args["department"]) ?? "44";
  const withExport = args["export"] === true;
  ctx.detail("provider", "la-bonne-alternance");
  ctx.detail(
    "query",
    `${city} · ${radius} km · département ${department}${withExport ? " · export" : ""}`,
  );

  const apiKey = envValue("LA_BONNE_ALTERNANCE_API_KEY");
  const keyType = (envValue("LA_BONNE_ALTERNANCE_KEY_TYPE") ?? "").toLowerCase();
  await ctx.step("Configuration", async () => {
    if (!apiKey)
      notConfigured(
        "Variable manquante : LA_BONNE_ALTERNANCE_API_KEY (clé gratuite sur https://api.apprentissage.beta.gouv.fr/compte/profil ; licence Etalab-2.0 ; CGU https://api.apprentissage.beta.gouv.fr/cgu ; clé de type « production » à demander à support_api@apprentissage.beta.gouv.fr)",
      );
    ctx.detail("keyType", keyType || "non renseigné");
    if (keyType !== "production")
      ctx.warn(
        `LA_BONNE_ALTERNANCE_KEY_TYPE=« ${keyType || "absent"} » : l'ingestion en base reste désactivée (données de test avec une clé sandbox) ; passer à « production » avec une clé de production.`,
      );
    return `clé présente (valeur masquée), type déclaré : ${keyType || "non renseigné"}`;
  });

  const { LaBonneAlternanceProvider, isFranceTravailRelay, lbaOfferSchema, mapLbaOffer } =
    await import("../../src/services/job-sources/providers/la-bonne-alternance");
  const { validateRawJob } = await import("../../src/services/ingestion/validate");
  const { normalizeJob } = await import("../../src/services/job-sources/normalize");
  const { findCity } = await import("../../src/config/cities");
  const provider = new LaBonneAlternanceProvider({
    apiKey,
    keyType,
    client: { timeoutMs: 20_000, maxRetries: 1 },
  });
  const client = provider.client();

  await ctx.step("Healthcheck authentifié (GET /healthcheck)", async () => {
    const t0 = Date.now();
    const res = await client.request<{ name?: string; version?: string; env?: string }>(
      "/healthcheck",
      undefined,
      "live",
    );
    ctx.detail("authLatencyMs", Date.now() - t0);
    return `${res.body?.name ?? "?"} · version ${res.body?.version ?? "?"} · env ${res.body?.env ?? "?"}`;
  });

  const summarize = (jobs: unknown[]) => {
    const byPartner: Record<string, number> = {};
    let relayed = 0;
    let invalid = 0;
    const mapped = [];
    for (const raw of jobs) {
      const parsed = lbaOfferSchema.safeParse(raw);
      if (!parsed.success) {
        invalid++;
        continue;
      }
      const label = parsed.data.identifier?.partner_label ?? "?";
      byPartner[label] = (byPartner[label] ?? 0) + 1;
      if (isFranceTravailRelay(parsed.data)) {
        relayed++;
        continue;
      }
      mapped.push(mapLbaOffer(parsed.data));
    }
    return { byPartner, relayed, invalid, mapped };
  };

  let sample: ReturnType<typeof summarize>["mapped"] = [];
  await ctx.step(`Recherche autour de ${city} (${radius} km)`, async () => {
    const c = findCity(city);
    if (!c) throw new Error(`Ville « ${city} » inconnue de src/config/cities.ts`);
    const t0 = Date.now();
    const res = await client.search({
      latitude: c.lat,
      longitude: c.lng,
      radius,
      partnersToExclude: ["France Travail"],
      priority: "live",
    });
    ctx.detail("latencyMs", Date.now() - t0);
    const s = summarize(res.jobs);
    sample = s.mapped;
    ctx.detail("count", s.mapped.length);
    ctx.detail("recruiters", res.recruiters.length);
    ctx.detail(
      "search.byPartner",
      Object.entries(s.byPartner)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ") || "—",
    );
    for (const w of res.warnings) ctx.warn(`${w.code} : ${w.message}`);
    for (const j of s.mapped.slice(0, 5))
      ctx.info(
        `${j.externalId} · ${j.title.slice(0, 70)} · ${j.companyName ?? "employeur non communiqué"} · ${j.city ?? "?"} · ${Number.isFinite(j.publishedAt.getTime()) ? j.publishedAt.toISOString().slice(0, 10) : "date absente"}`,
      );
    if (s.mapped.length === 0)
      ctx.warn(
        "Aucune offre : élargis le rayon avant de conclure à un problème (ou clé sandbox = données de test).",
      );
    return `${s.mapped.length} offre(s) exploitables · ${s.relayed} relais France Travail exclus · ${s.invalid} au format inattendu · ${res.recruiters.length} entreprise(s) à candidature spontanée`;
  });

  await ctx.step(`Recherche par département (${department})`, async () => {
    const t0 = Date.now();
    const res = await client.search({
      departements: [department],
      partnersToExclude: ["France Travail"],
      priority: "live",
    });
    const s = summarize(res.jobs);
    ctx.detail("department.count", s.mapped.length);
    ctx.detail("department.latencyMs", Date.now() - t0);
    const capped = Object.values(s.byPartner).some((n) => n >= 150);
    if (capped)
      ctx.warn(
        "Borne de 150 offres par source atteinte : la recherche n'est pas exhaustive (l'export complet l'est).",
      );
    return `${s.mapped.length} offre(s) exploitables · ${
      Object.entries(s.byPartner)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "aucune"
    }`;
  });

  await ctx.step("Validation et normalisation", async () => {
    const rejected: Record<string, number> = {};
    let accepted = 0;
    for (const raw of sample) {
      const v = validateRawJob(raw);
      if (!v.ok) rejected[v.code] = (rejected[v.code] ?? 0) + 1;
      else accepted++;
    }
    ctx.detail("normalized", accepted);
    ctx.detail("rejected", sample.length - accepted);
    const ok = sample.find((j) => validateRawJob(j).ok);
    if (ok) {
      const job = normalizeJob(ok, { key: provider.key, type: provider.type, isDemo: false });
      ctx.info(
        `Exemple : « ${job.title.slice(0, 60)} » → ${job.jobFamily}, ${job.city} (${job.department ?? "?"}), ${job.contractType}, ${job.durationMonths ?? "?"} mois, télétravail ${job.remote}, URL candidature ${job.applicationUrl ? "présente" : "absente"}, expire ${job.expiresAt ? job.expiresAt.toISOString().slice(0, 10) : "?"}`,
      );
    }
    return `${accepted} acceptée(s), ${sample.length - accepted} rejetée(s)${
      Object.keys(rejected).length
        ? ` (${Object.entries(rejected)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")})`
        : ""
    }`;
  });

  if (withExport) {
    await ctx.step("Export complet (GET /job/v1/export puis téléchargement)", async () => {
      const t0 = Date.now();
      const catalogue = await provider.loadCatalogue("backfill");
      ctx.detail("export.latencyMs", Date.now() - t0);
      ctx.detail("export.total", catalogue.total);
      ctx.detail("export.departments", catalogue.byDepartment.size);
      ctx.detail("export.withoutDepartment", catalogue.withoutDepartment.length);
      ctx.detail("export.lastUpdate", catalogue.lastUpdate);
      let relayed = 0;
      for (const raws of catalogue.byDepartment.values())
        for (const raw of raws)
          if (
            /france\s*travail/i.test(
              String(
                (raw as { identifier?: { partner_label?: string } })?.identifier?.partner_label ??
                  "",
              ),
            )
          )
            relayed++;
      ctx.detail("export.franceTravailRelays", relayed);
      const top = [...catalogue.byDepartment.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8)
        .map(([k, v]) => `${k}: ${v.length}`)
        .join(" · ");
      ctx.info(`Départements les plus fournis : ${top}`);
      return `${catalogue.total} offre(s) dans l'export du ${catalogue.lastUpdate || "?"} · ${catalogue.byDepartment.size} département(s) · ${relayed} relais France Travail (exclus à l'ingestion)`;
    });
  } else {
    ctx.info(
      "Export complet non testé (ajoute --export : 2 appels / min autorisés, fichier volumineux).",
    );
  }
});

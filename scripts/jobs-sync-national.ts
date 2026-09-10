/**
 * SYNCHRONISATION NATIONALE DES ALTERNANCES (Phase 30) — reprenable, idempotente, découpée, observable.
 *
 *   npm run jobs:sync:national -- --scope pdl                       # Pays de la Loire, fenêtre 31 j (rattrapage)
 *   npm run jobs:sync:national -- --scope bretagne --window 31d
 *   npm run jobs:sync:national -- --scope france --window 31d --max-minutes 320
 *   npm run jobs:sync:national -- --departments 44,49 --window 7d
 *   npm run jobs:sync:national -- --mode incremental --max-minutes 100 --backfill-budget 12
 *
 * Modes :
 *   backfill    (défaut) : chaque territoire du périmètre, fenêtre demandée, dans l'ordre de priorité ;
 *                          un territoire synchronisé avec succès il y a moins de --max-age-hours (20) est ignoré.
 *   incremental          : priorité 1 — nouveautés (fenêtre 1 j) sur toute la France ; priorité 2 — zones très
 *                          demandées (fenêtre 7 j, si > 12 h) ; priorité 3 — recherches populaires anciennes ;
 *                          priorité 4 — rattrapage 31 j des territoires les plus anciens (--backfill-budget).
 *
 * Un run interrompu (budget de temps, erreur, crash) conserve son curseur : le suivant reprend là.
 */
import {
  ALL_DEPARTMENT_CODES,
  HOT_DEPARTMENT_CODES,
  PRIORITY_DEPARTMENT_CODES,
} from "../src/config/departments";
import type { SyncWindow, TerritorySyncResult } from "../src/services/ingestion/national-sync";
import {
  disconnectPrisma,
  EXIT,
  fail,
  heading,
  info,
  num,
  ok,
  parseArgs,
  runMain,
  str,
  warn,
} from "./lib/bootstrap";

const SCOPES: Record<string, { regions?: string[]; departments?: string[]; all?: boolean }> = {
  pdl: { regions: ["Pays de la Loire"] },
  bretagne: { regions: ["Bretagne"] },
  ouest: { regions: ["Pays de la Loire", "Bretagne"] },
  france: { all: true },
};

runMain(async () => {
  const args = parseArgs();
  const { getJobSourceProviders } = await import("../src/services/job-sources");
  const { getQuotaManager } = await import("../src/services/job-sources/quota");
  const { prismaQuotaStore, purgeQuotaCounters, recentQuotaUsage } =
    await import("../src/services/job-sources/quota-store");
  const { planTerritories, runNationalSync, staleTerritories, SYNC_WINDOW_KEYS } =
    await import("../src/services/ingestion/national-sync");
  const { popularStaleSearches, runLiveRefresh } =
    await import("../src/services/ingestion/live-refresh");
  const { getCoverageReport, formatCoverageReport } =
    await import("../src/services/ingestion/coverage");

  const provider = getJobSourceProviders().find(
    (p) => p.key === (str(args["source"]) ?? "france-travail"),
  );
  if (!provider) {
    fail("Source inconnue.");
    return EXIT.FAILED;
  }
  const status = await provider.status();
  if (!status.configured) {
    warn(`Ignorée : ${status.reason}`);
    await disconnectPrisma();
    return EXIT.NOT_CONFIGURED;
  }
  // Quota partagé entre processus : le compteur par minute vit en base.
  getQuotaManager(provider.key, { shared: prismaQuotaStore });

  const mode = str(args["mode"]) ?? "backfill";
  const windowArg = str(args["window"]) ?? "31d";
  if (!SYNC_WINDOW_KEYS.includes(windowArg as SyncWindow)) {
    fail(`Fenêtre inconnue : ${windowArg} (${SYNC_WINDOW_KEYS.join(", ")})`);
    return EXIT.FAILED;
  }
  const window = windowArg as SyncWindow;
  const maxMinutes = num(args["max-minutes"]) ?? 300;
  const maxAgeHours = num(args["max-age-hours"]) ?? 20;
  const trigger = str(args["trigger"]) ?? "cli";
  const workerId = `${trigger}-${process.env["GITHUB_RUN_ID"] ?? process.pid}`;
  const started = Date.now();
  const deadline = started + maxMinutes * 60_000;
  const remainingMinutes = () => Math.max(0, (deadline - Date.now()) / 60_000);

  const scopeArg = str(args["scope"]);
  const departments = str(args["departments"])
    ?.split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const regions = str(args["regions"])
    ?.split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const scope = scopeArg ? SCOPES[scopeArg] : undefined;
  if (scopeArg && !scope) {
    fail(`Périmètre inconnu : ${scopeArg} (${Object.keys(SCOPES).join(", ")})`);
    return EXIT.FAILED;
  }

  const line = (r: TerritorySyncResult) => {
    const msg = `${r.territory} · ${r.window} · ${r.status} · ${r.chunks} morceau(x) · ${r.fetched} récupérées · ${r.created} créées · ${r.updated} revues (${r.unchanged} inchangées) · ${r.duplicates} rattachées · ${r.rejected} rejetées · ${r.failed} en erreur · ${r.removed} retirées · ${r.requests} req · ${(r.durationMs / 1000).toFixed(1)} s`;
    if (r.status === "error") fail(msg);
    else if (r.status === "fresh" || r.status === "locked") info(msg);
    else if (r.status === "success") ok(msg);
    else warn(msg);
    for (const e of r.errors.slice(0, 2)) fail(`    ${e}`);
    for (const w of r.warnings.slice(0, 2)) if (!w.startsWith("Rejets")) warn(`    ${w}`);
  };

  let exit: number = EXIT.OK;
  const summarize = (label: string, report: Awaited<ReturnType<typeof runNationalSync>>) => {
    const msg = `${label} : ${report.synced} synchronisé(s), ${report.fresh} déjà à jour, ${report.locked} verrouillé(s), ${report.interrupted} interrompu(s), ${report.errors} en erreur · ${report.fetched} récupérées · ${report.created} créées · ${report.updated} revues (${report.unchanged} inchangées) · ${report.removed} retirées · ${report.requests} requêtes · ${(report.durationMs / 1000).toFixed(0)} s${report.deadlineReached ? " · budget de temps atteint" : ""}`;
    if (report.errors > 0 && report.synced === report.errors) {
      fail(msg);
      exit = EXIT.FAILED;
    } else if (report.errors > 0 || report.interrupted > 0) warn(msg);
    else ok(msg);
  };

  if (mode === "incremental") {
    // Priorité 1 : nouveautés sur toute la France (fenêtre 1 jour, une à deux requêtes par département).
    heading("Priorité 1 — nouvelles offres (France entière, fenêtre 1 j)");
    const p1 = await runNationalSync({
      provider,
      territories: planTerritories({ all: true }),
      window: "1d",
      trigger,
      workerId,
      priority: "recent",
      maxMinutes: Math.min(remainingMinutes(), maxMinutes * 0.5),
      maxAgeHours: num(args["recent-max-age-hours"]) ?? 1.5,
      onTerritory: line,
    });
    summarize("Nouveautés", p1);

    // Priorité 2 : zones très demandées (fenêtre 7 j).
    heading("Priorité 2 — zones très demandées (fenêtre 7 j)");
    const hot = planTerritories({
      departments: [...PRIORITY_DEPARTMENT_CODES, ...HOT_DEPARTMENT_CODES],
    });
    const p2 = await runNationalSync({
      provider,
      territories: hot,
      window: "7d",
      trigger,
      workerId,
      priority: "recent",
      maxMinutes: Math.min(remainingMinutes(), maxMinutes * 0.25),
      maxAgeHours: num(args["hot-max-age-hours"]) ?? 12,
      onTerritory: line,
    });
    summarize("Zones demandées", p2);

    // Priorité 3 : recherches populaires dont l'actualisation est ancienne.
    heading("Priorité 3 — recherches populaires");
    const searches = await popularStaleSearches(num(args["popular-limit"]) ?? 20);
    let refreshed = 0;
    for (const target of searches) {
      if (remainingMinutes() <= 0) break;
      const r = await runLiveRefresh(target, { workerId });
      if (r.status === "refreshed") refreshed++;
      info(
        `${target.label} · ${r.status} · ${r.created} créées · ${r.updated} revues · ${r.requests} req`,
      );
    }
    ok(`${refreshed} recherche(s) rafraîchie(s) sur ${searches.length} candidate(s)`);

    // Priorité 4 : rattrapage progressif du reste du catalogue (fenêtre 31 j), territoires les plus anciens d'abord.
    heading("Priorité 4 — rattrapage du catalogue (fenêtre 31 j)");
    const budget = num(args["backfill-budget"]) ?? 12;
    const stale = await staleTerritories(
      provider.key,
      "31d",
      planTerritories({ all: true }),
      budget,
    );
    const p4 = await runNationalSync({
      provider,
      territories: stale,
      window: "31d",
      trigger,
      workerId,
      priority: "backfill",
      maxMinutes: remainingMinutes(),
      maxAgeHours: maxAgeHours,
      maxTerritories: budget,
      onTerritory: line,
    });
    summarize("Rattrapage", p4);
  } else {
    const territories = planTerritories(
      scope ?? { departments, regions, all: !departments?.length && !regions?.length },
    );
    heading(
      `Rattrapage — ${territories.length} territoire(s), fenêtre ${window}, budget ${maxMinutes} min, ordre : ${territories.slice(0, 12).join(" ")}${territories.length > 12 ? " …" : ""}`,
    );
    const report = await runNationalSync({
      provider,
      territories,
      window,
      trigger,
      workerId,
      priority: window === "1d" ? "recent" : "backfill",
      maxMinutes,
      maxAgeHours: args["force"] ? undefined : maxAgeHours,
      onTerritory: line,
    });
    summarize("Rattrapage", report);
  }

  heading("Quota");
  const usage = await recentQuotaUsage(provider.key, 60);
  const stats = getQuotaManager(provider.key).stats();
  info(
    `${usage.requests} requêtes sur 60 min (pic ${usage.peakPerMinute}/min, plafond ${stats.perMinuteLimit}/min) · débit ${stats.maxPerSecond}/s · concurrence ${stats.maxConcurrency} · 429 : ${stats.rateLimited} · attente cumulée ${(stats.waitedMs / 1000).toFixed(0)} s`,
  );
  await purgeQuotaCounters(24);

  heading("Couverture réelle");
  console.log(
    formatCoverageReport(await getCoverageReport(), { maxDepartments: 25 })
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );

  info(
    `Durée totale : ${((Date.now() - started) / 60_000).toFixed(1)} min · ${ALL_DEPARTMENT_CODES.length} territoires connus`,
  );
  await disconnectPrisma();
  return exit;
});

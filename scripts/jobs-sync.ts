/**
 * SYNCHRONISATION DES OFFRES (exécutable hors Vercel, Phase 28)
 *
 *   npm run jobs:sync                                # France Travail, départements prioritaires (Pays de la Loire + Bretagne), 31 jours
 *   npm run jobs:sync -- --source france-travail --q developpeur --city Nantes --radius 30
 *   npm run jobs:sync -- --department 44 --since-days 7 --limit 1150
 *   npm run jobs:sync -- --all-sources                # toutes les sources configurées
 */
import { PRIORITY_DEPARTMENT_CODES } from "../src/config/departments";
import { disconnectPrisma, EXIT, fail, heading, info, num, ok, parseArgs, runMain, str, warn } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { getJobSourceProviders } = await import("../src/services/job-sources");
  const { runIngestion } = await import("../src/services/ingestion");
  const providers = getJobSourceProviders();
  const wanted = str(args["source"]) ?? (args["all-sources"] ? undefined : "france-travail");
  const selected = wanted ? providers.filter((p) => p.key === wanted) : providers;
  if (selected.length === 0) {
    fail(`Source inconnue : ${wanted}. Disponibles : ${providers.map((p) => p.key).join(", ")}`);
    return EXIT.FAILED;
  }
  const keywords = str(args["q"]);
  const city = str(args["city"]);
  const radiusKm = num(args["radius"]);
  const department = str(args["department"]);
  const limit = num(args["limit"]);
  const publishedWithinDays = num(args["since-days"]) ?? 31;
  const trigger = str(args["trigger"]) ?? "cli";

  let exit: number = EXIT.OK;
  for (const provider of selected) {
    const status = await provider.status();
    heading(`Source ${provider.name} (${provider.key})`);
    if (!status.configured) {
      warn(`Ignorée : ${status.reason}`);
      if (selected.length === 1) exit = EXIT.NOT_CONFIGURED;
      await runIngestion({ provider, trigger });
      continue;
    }
    // Sans ciblage explicite, on couvre les départements prioritaires un à un (limite API par requête).
    const targets = city || department || keywords || !provider.capabilities.supportsLocation ? [{ city, department }] : PRIORITY_DEPARTMENT_CODES.map((d) => ({ city: undefined, department: d }));
    for (const target of targets) {
      const params = { keywords, city: target.city, radiusKm, department: target.department, limit, publishedWithinDays };
      info(`Paramètres : ${JSON.stringify(params)}`);
      const report = await runIngestion({ provider, params, trigger });
      const line = `${report.fetched} récupérées · ${report.created} créées · ${report.updated} mises à jour · ${report.duplicates} rattachées · ${report.rejected} rejetées · ${report.failed} en erreur · ${report.durationMs} ms (run ${report.runId})`;
      if (report.errors.length && report.fetched === 0) {
        fail(line);
        for (const e of report.errors.slice(0, 3)) fail(e);
        exit = EXIT.FAILED;
      } else ok(line);
      for (const w of report.warnings) warn(w);
    }
  }
  await disconnectPrisma();
  return exit;
});

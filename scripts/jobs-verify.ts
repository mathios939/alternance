/**
 * VÉRIFICATION DES OFFRES auprès de leur source (Phase 7 / 28).
 *
 *   npm run jobs:verify                                   # France Travail, offres non vérifiées depuis 24 h, 200 max
 *   npm run jobs:verify -- --source france-travail --older-than-hours 12 --limit 500
 */
import { disconnectPrisma, EXIT, fail, heading, num, ok, parseArgs, runMain, str, warn } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { getJobSourceProviders } = await import("../src/services/job-sources");
  const { verifySourceJobs } = await import("../src/services/ingestion");
  const key = str(args["source"]) ?? "france-travail";
  const provider = getJobSourceProviders().find((p) => p.key === key);
  if (!provider) {
    fail(`Source inconnue : ${key}`);
    return EXIT.FAILED;
  }
  heading(`Vérification ${provider.name}`);
  const report = await verifySourceJobs({ provider, olderThanHours: num(args["older-than-hours"]) ?? 24, limit: num(args["limit"]) ?? 200, trigger: str(args["trigger"]) ?? "cli" });
  await disconnectPrisma();
  if (report.skipped) {
    warn(`Ignorée : ${report.reason}`);
    return provider.capabilities.supportsVerification ? EXIT.NOT_CONFIGURED : EXIT.OK;
  }
  ok(`${report.checked} vérifiée(s) · ${report.active} actives · ${report.removed} retirées · ${report.unknown} indéterminées · ${report.durationMs} ms (run ${report.runId})`);
  return EXIT.OK;
});

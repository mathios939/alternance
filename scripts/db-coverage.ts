/**
 * COUVERTURE RÉELLE DE LA BASE (production ou locale) : nombres mesurés, jamais estimés.
 *
 *   npm run db:coverage            # texte (TOTAL_OFFERS, ACTIVE_ALTERNANCE, LAST_24H, LAST_7_DAYS, BY_REGION, BY_DEPARTMENT, BY_SOURCE…)
 *   npm run db:coverage -- --json  # JSON complet
 */
import { disconnectPrisma, EXIT, parseArgs, runMain } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { getCoverageReport, formatCoverageReport } =
    await import("../src/services/ingestion/coverage");
  const report = await getCoverageReport();
  if (args["json"]) console.log(JSON.stringify(report, null, 2));
  else console.log(formatCoverageReport(report, { maxDepartments: args["all"] ? undefined : 40 }));
  await disconnectPrisma();
  return EXIT.OK;
});

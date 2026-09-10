/**
 * CONTRÔLE QUALITÉ NATIONAL (production ou locale) : complétude et incohérences MESURÉES sur les
 * offres réelles visibles. Rien n'est corrigé ni inventé.
 *
 *   npm run db:quality
 *   npm run db:quality -- --json
 */
import { disconnectPrisma, EXIT, parseArgs, runMain } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { getQualityReport, formatQualityReport } = await import("../src/services/ingestion/quality-report");
  const report = await getQualityReport();
  console.log(args["json"] ? JSON.stringify(report, null, 2) : formatQualityReport(report));
  await disconnectPrisma();
  return EXIT.OK;
});

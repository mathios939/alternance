/**
 * EXPIRATION DES OFFRES selon les règles explicites (Phase 7).
 *   npm run jobs:expire
 */
import { disconnectPrisma, EXIT, heading, ok, parseArgs, runMain, str } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { expireJobs, EXPIRATION_RULES } = await import("../src/services/ingestion");
  heading(`Expiration (obsolète après ${EXPIRATION_RULES.staleAfterDays} j, expirée après ${EXPIRATION_RULES.expireUnverifiedAfterDays} j sans vérification, ${EXPIRATION_RULES.maxAgeDays} j max)`);
  const report = await expireJobs({ trigger: str(args["trigger"]) ?? "cli" });
  ok(`${report.expiredBySource} expirées (source) · ${report.expiredUnverified} expirées (non vérifiées) · ${report.expiredTooOld} expirées (trop anciennes) · ${report.markedUnknown} passées en « non vérifiée » · ${report.durationMs} ms`);
  await disconnectPrisma();
  return EXIT.OK;
});

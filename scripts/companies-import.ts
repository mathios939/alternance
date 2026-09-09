/**
 * IMPORT CIBLÉ D'ENTREPRISES RÉELLES (Phase 9) — API Recherche d'entreprises (sans clé).
 *
 *   npm run companies:import                                  # départements prioritaires × NAF numérique/marketing, 100 fiches par couple
 *   npm run companies:import -- --department 44 --naf 62.01Z,62.02A --max 200
 *   npm run companies:import -- --department 35 --family marketing --min-employees 11
 *   npm run companies:import -- --q "agence marketing" --department 35
 */
import { PRIORITY_DEPARTMENT_CODES } from "../src/config/departments";
import { disconnectPrisma, EXIT, fail, heading, info, num, ok, parseArgs, runMain, str, warn } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { getCompanyDataProvider, JOB_FAMILY_NAF_HINTS } = await import("../src/services/company-data");
  const { importCompanies } = await import("../src/services/company-data/import");
  const provider = getCompanyDataProvider();
  if (!provider) return EXIT.FAILED;
  const status = await provider.status();
  if (!status.configured) {
    fail(status.reason ?? "Provider non configuré");
    return EXIT.NOT_CONFIGURED;
  }
  const departments = str(args["department"])?.split(",").map((d) => d.trim()) ?? [...PRIORITY_DEPARTMENT_CODES];
  const family = str(args["family"]);
  const nafCodes = str(args["naf"])?.split(",").map((s) => s.trim()) ?? (family ? JOB_FAMILY_NAF_HINTS[family] : undefined) ?? [...new Set([...(JOB_FAMILY_NAF_HINTS["dev"] ?? []), ...(JOB_FAMILY_NAF_HINTS["marketing"] ?? [])])];
  const text = str(args["q"]);
  const max = num(args["max"]) ?? 100;
  const minEmployeeRange = str(args["min-employees"]);
  let exit: number = EXIT.OK;
  for (const department of departments) {
    heading(`Département ${department} · NAF ${nafCodes.join(", ")}${text ? ` · « ${text} »` : ""}`);
    const report = await importCompanies({ provider, params: { text, nafCodes, departmentCodes: [department], minEmployeeRange }, maxRecords: max, trigger: str(args["trigger"]) ?? "cli" });
    const line = `${report.fetched} fiches · ${report.created} créées · ${report.updated} mises à jour · ${report.skipped} ignorées · ${report.failed} en erreur · ${report.durationMs} ms (run ${report.runId})`;
    if (report.errors.length && report.fetched === 0) {
      fail(line);
      for (const e of report.errors.slice(0, 3)) fail(e);
      exit = EXIT.FAILED;
    } else ok(line);
    for (const w of report.warnings.slice(0, 3)) warn(w);
    info("Source : Annuaire des entreprises (SIRENE, licence ouverte). Sites web et descriptions ne sont pas fournis : ils restent vides.");
  }
  await disconnectPrisma();
  return exit;
});

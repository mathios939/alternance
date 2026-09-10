/**
 * TESTS EXTERNES — exécute chaque test réseau à la suite et résume (jamais lancé par `npm test`).
 *   npm run test:external
 * Codes : 0 tout passe · 1 au moins un échec · 2 uniquement des configurations manquantes.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { c, EXIT, fail, heading, ok, warn } from "../../scripts/lib/bootstrap";
import type { ExternalResult } from "./lib/harness";

const SUITES: Array<[label: string, script: string, slug: string]> = [
  ["France Travail", "tests/external/france-travail.ts", "france-travail"],
  ["La bonne alternance", "tests/external/la-bonne-alternance.ts", "la-bonne-alternance"],
  ["API Recherche d'entreprises", "tests/external/companies.ts", "companies"],
  ["OSRM", "tests/external/osrm.ts", "osrm"],
  ["Fournisseur IA", "tests/external/ai-provider.ts", "ai-provider"],
];

const dir = process.env["EXTERNAL_RESULTS_DIR"] ?? ".external-results";
let failed = false;
let missing = false;
const rows: string[] = [];
for (const [label, script, slug] of SUITES) {
  heading(`▶ ${label}`);
  const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), script], {
    stdio: "inherit",
    env: process.env,
  });
  const file = join(dir, `${slug}.json`);
  const parsed = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as ExternalResult)
    : null;
  const status =
    parsed?.status ??
    (result.status === EXIT.NOT_CONFIGURED
      ? "NOT_CONFIGURED"
      : result.status === EXIT.OK
        ? "SUCCESS"
        : "FAILED");
  rows.push(
    `${label.padEnd(28)} ${status}${parsed?.details["latencyMs"] !== undefined ? ` · ${parsed.details["latencyMs"]} ms` : ""}${parsed?.details["count"] !== undefined ? ` · ${parsed.details["count"]} résultat(s)` : ""}`,
  );
  if (status === "SUCCESS") ok(`${label} : SUCCESS`);
  else if (status === "NOT_CONFIGURED") {
    warn(`${label} : SKIPPED — SECRET NOT CONFIGURED`);
    missing = true;
  } else {
    fail(`${label} : ${status}`);
    failed = true;
  }
}
heading("External Validation");
for (const r of rows) console.log(`  ${r}`);
console.log(c.dim(`  testé le ${new Date().toISOString()}`));
process.exit(failed ? EXIT.FAILED : missing ? EXIT.NOT_CONFIGURED : EXIT.OK);

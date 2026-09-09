/**
 * TESTS EXTERNES — exécute chaque test réseau et résume (jamais lancé par `npm test`).
 *   npm run test:external
 * Codes : 0 tout passe · 1 au moins un échec · 2 uniquement des configurations manquantes.
 */
import { spawnSync } from "node:child_process";
import { EXIT, fail, heading, ok, warn } from "./lib/bootstrap";

const SUITES = [
  ["France Travail", "scripts/test-france-travail.ts", ["--dry-run", "--limit", "20"]],
  ["Fournisseur IA", "scripts/test-ai-provider.ts", []],
  ["OSRM", "scripts/test-osrm.ts", []],
  ["Recherche d'entreprises", "scripts/test-companies.ts", []],
] as const;

let failed = false;
let missing = false;
for (const [name, script, extra] of SUITES) {
  heading(`▶ ${name}`);
  const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), script, ...extra], { stdio: "inherit", env: process.env });
  if (result.status === EXIT.OK) ok(`${name} : OK`);
  else if (result.status === EXIT.NOT_CONFIGURED) {
    warn(`${name} : configuration manquante`);
    missing = true;
  } else {
    fail(`${name} : échec`);
    failed = true;
  }
}
process.exit(failed ? EXIT.FAILED : missing ? EXIT.NOT_CONFIGURED : EXIT.OK);

/**
 * Relit le résultat JSON d'un test externe et l'expose à GitHub Actions :
 *   tsx tests/external/report.ts <slug>
 * Écrit `status`, `latency_ms`, `count`, `provider`, `tested_at`, `message` dans $GITHUB_OUTPUT
 * (et sur la sortie standard). Fichier absent → status=NOT_RUN. Aucune valeur sensible.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExternalResult } from "./lib/harness";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage : tsx tests/external/report.ts <slug>");
  process.exit(1);
}
const file = join(process.env["EXTERNAL_RESULTS_DIR"] ?? ".external-results", `${slug}.json`);
const result = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ExternalResult) : null;
const clean = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, 300);
const outputs: Record<string, string> = {
  status: result?.status ?? "NOT_RUN",
  latency_ms: clean(result?.details["latencyMs"] ?? ""),
  count: clean(result?.details["count"] ?? result?.details["inserted"] ?? ""),
  provider: clean(result?.details["provider"] ?? ""),
  model: clean(result?.details["model"] ?? ""),
  tested_at: result?.testedAt ?? "",
  message: clean(result?.message ?? ""),
};
for (const [k, v] of Object.entries(outputs)) console.log(`${k}=${v}`);
const target = process.env["GITHUB_OUTPUT"];
if (target) appendFileSync(target, Object.entries(outputs).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

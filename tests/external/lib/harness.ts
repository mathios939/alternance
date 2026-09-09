import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { c, fail, heading, info, ok, warn } from "../../../scripts/lib/bootstrap";

/**
 * HARNESS DES TESTS EXTERNES (réseau et/ou clés requis, jamais lancés par `npm test`).
 *
 * Chaque test se termine par un statut explicite :
 *   SUCCESS · NOT_CONFIGURED · NETWORK_ERROR · AUTH_ERROR · RATE_LIMIT · INVALID_RESPONSE · FAILED
 * et produit un résultat JSON non sensible (`.external-results/<slug>.json`) réutilisé par
 * GitHub Actions pour le résumé. Aucune valeur de secret n'est jamais écrite ni affichée.
 *
 * Codes de retour : 0 SUCCESS · 2 NOT_CONFIGURED · 1 tout autre statut.
 */
export type ExternalStatus = "SUCCESS" | "NOT_CONFIGURED" | "NETWORK_ERROR" | "AUTH_ERROR" | "RATE_LIMIT" | "INVALID_RESPONSE" | "FAILED";

export const EXIT_CODES: Record<ExternalStatus, number> = { SUCCESS: 0, NOT_CONFIGURED: 2, NETWORK_ERROR: 1, AUTH_ERROR: 1, RATE_LIMIT: 1, INVALID_RESPONSE: 1, FAILED: 1 };

export type DetailValue = string | number | boolean | null;

export type StepRecord = { name: string; status: "ok" | "warn" | "fail" | "skip"; message: string | null; durationMs: number };

export type ExternalResult = {
  name: string;
  slug: string;
  status: ExternalStatus;
  testedAt: string;
  durationMs: number;
  message: string | null;
  details: Record<string, DetailValue>;
  steps: StepRecord[];
};

export class ExternalTestError extends Error {
  constructor(
    message: string,
    public readonly status: Exclude<ExternalStatus, "SUCCESS">,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExternalTestError";
  }
}

/** À lever quand une variable / un secret manque : le test s'arrête en NOT_CONFIGURED (code 2). */
export function notConfigured(message: string): never {
  throw new ExternalTestError(message, "NOT_CONFIGURED");
}

export function invalidResponse(message: string): never {
  throw new ExternalTestError(message, "INVALID_RESPONSE");
}

/** Classe une erreur quelconque dans une catégorie explicite (jamais un simple « test failed »). */
export function classifyError(error: unknown): Exclude<ExternalStatus, "SUCCESS"> {
  if (error instanceof ExternalTestError) return error.status;
  const code = (error as { code?: string } | null)?.code;
  const name = (error as { name?: string } | null)?.name;
  const message = String((error as Error | null)?.message ?? error);
  if (code === "AUTH" || code === "UNAUTHENTICATED") return "AUTH_ERROR";
  if (code === "RATE_LIMITED") return "RATE_LIMIT";
  if (code === "NETWORK" || code === "TIMEOUT" || code === "UNAVAILABLE" || code === "SERVER") return "NETWORK_ERROR";
  if (code === "PARSE" || code === "BAD_REQUEST" || code === "NOT_FOUND") return "INVALID_RESPONSE";
  if (name === "AbortError" || name === "TimeoutError") return "NETWORK_ERROR";
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|ETIMEDOUT|fetch failed|tunnel|network|injoignable|socket hang up/i.test(message)) return "NETWORK_ERROR";
  if (/\b(401|403)\b|unauthori|invalid api key|authentication|clé api invalide/i.test(message)) return "AUTH_ERROR";
  if (/\b429\b|rate limit|limite de débit|limite de requêtes/i.test(message)) return "RATE_LIMIT";
  if (/non json|format inattendu|invalid response|unexpected token/i.test(message)) return "INVALID_RESPONSE";
  return "FAILED";
}

export type TestContext = {
  /** Exécute une étape ; le message retourné est journalisé et conservé dans le rapport. */
  step: (name: string, fn: () => Promise<string | void>) => Promise<void>;
  /** Détail non sensible (latence, compteur, fournisseur…) repris dans le résumé GitHub. */
  detail: (key: string, value: DetailValue) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
};

function resultsDir(): string {
  return process.env["EXTERNAL_RESULTS_DIR"] ?? ".external-results";
}

/** Écrit une section Markdown dans le résumé GitHub Actions si disponible. */
export function appendGithubSummary(markdown: string): void {
  const file = process.env["GITHUB_STEP_SUMMARY"];
  if (!file) return;
  try {
    appendFileSync(file, `${markdown}\n`);
  } catch {
    /* résumé indisponible : sans conséquence */
  }
}

export function statusEmoji(status: ExternalStatus | string): string {
  if (status === "SUCCESS") return "✅ PASS";
  if (status === "NOT_CONFIGURED") return "⚪ NOT CONFIGURED";
  if (status === "NOT_RUN") return "⚪ NOT RUN";
  return `❌ FAIL (${status})`;
}

export function renderSummary(result: ExternalResult): string {
  const lines = [`### ${result.name} — ${statusEmoji(result.status)}`, ""];
  if (result.message) lines.push(`> ${result.message}`, "");
  const rows = Object.entries(result.details);
  if (rows.length) {
    lines.push("| Détail | Valeur |", "|---|---|");
    for (const [k, v] of rows) lines.push(`| ${k} | ${v === null ? "—" : String(v)} |`);
    lines.push("");
  }
  if (result.steps.length) {
    for (const s of result.steps) lines.push(`- ${s.status === "ok" ? "✅" : s.status === "warn" ? "⚠️" : s.status === "skip" ? "⏭️" : "❌"} ${s.name}${s.message ? ` — ${s.message}` : ""} (${s.durationMs} ms)`);
    lines.push("");
  }
  lines.push(`_Testé le ${result.testedAt} · ${result.durationMs} ms_`, "");
  return lines.join("\n");
}

/**
 * Exécute un test externe complet : étapes, classification des erreurs, résultat JSON,
 * résumé GitHub et code de sortie. Ne retourne jamais (process.exit).
 */
export async function runExternalTest(name: string, slug: string, fn: (ctx: TestContext) => Promise<void>): Promise<never> {
  const startedAt = Date.now();
  const testedAt = new Date().toISOString();
  const steps: StepRecord[] = [];
  const details: Record<string, DetailValue> = {};
  let status: ExternalStatus = "SUCCESS";
  let message: string | null = null;

  heading(`${name} — test externe (${testedAt})`);
  const ctx: TestContext = {
    step: async (stepName, stepFn) => {
      const t0 = Date.now();
      try {
        const out = await stepFn();
        const durationMs = Date.now() - t0;
        steps.push({ name: stepName, status: "ok", message: out ?? null, durationMs });
        ok(`${stepName}${out ? ` : ${out}` : ""} ${c.dim(`(${durationMs} ms)`)}`);
      } catch (error) {
        const durationMs = Date.now() - t0;
        const category = classifyError(error);
        const text = error instanceof Error ? error.message : String(error);
        steps.push({ name: stepName, status: category === "NOT_CONFIGURED" ? "skip" : "fail", message: text, durationMs });
        (category === "NOT_CONFIGURED" ? warn : fail)(`${stepName} : ${text}`);
        throw error;
      }
    },
    detail: (key, value) => {
      details[key] = value;
    },
    warn: (text) => {
      steps.push({ name: text, status: "warn", message: null, durationMs: 0 });
      warn(text);
    },
    info,
  };

  try {
    await fn(ctx);
  } catch (error) {
    status = classifyError(error);
    message = error instanceof Error ? error.message : String(error);
  }

  const result: ExternalResult = { name, slug, status, testedAt, durationMs: Date.now() - startedAt, message, details, steps };
  try {
    mkdirSync(resultsDir(), { recursive: true });
    writeFileSync(join(resultsDir(), `${slug}.json`), JSON.stringify(result, null, 2));
  } catch (error) {
    warn(`Résultat JSON non écrit : ${error instanceof Error ? error.message : String(error)}`);
  }
  appendGithubSummary(renderSummary(result));

  heading("Résultat");
  if (status === "SUCCESS") ok(`${name} : SUCCESS (${result.durationMs} ms)`);
  else if (status === "NOT_CONFIGURED") {
    warn(`SKIPPED — SECRET NOT CONFIGURED : ${message}`);
    if (process.env["GITHUB_ACTIONS"]) console.log(`::warning title=${name}::SKIPPED — SECRET NOT CONFIGURED — ${message}`);
  } else {
    fail(`${name} : ${status} — ${message}`);
    if (process.env["GITHUB_ACTIONS"]) console.log(`::error title=${name}::${status} — ${message}`);
  }
  console.log(`RESULT=${status}`);
  process.exit(EXIT_CODES[status]);
}

/** Valeur d'une variable d'environnement non vide, sinon undefined (jamais affichée). */
export function envValue(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** Vérifie qu'une URL a un format http(s) valide (sans la contacter). */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

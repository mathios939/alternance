import "dotenv/config";

/**
 * Socle commun des scripts CLI : chargement de `.env`, sortie lisible, codes de retour.
 * Codes : 0 succès · 1 échec · 2 configuration manquante (clé / variable absente).
 */
export const EXIT = { OK: 0, FAILED: 1, NOT_CONFIGURED: 2 } as const;

const useColor = process.stdout.isTTY && !process.env["NO_COLOR"];
const ESC = `${String.fromCharCode(27)}[`;
const paint = (code: string) => (s: string) => (useColor ? `${ESC}${code}m${s}${ESC}0m` : s);
export const c = { green: paint("32"), red: paint("31"), yellow: paint("33"), dim: paint("2"), bold: paint("1"), cyan: paint("36") };

export function heading(title: string) {
  console.log(`\n${c.bold(title)}`);
}
export function ok(msg: string) {
  console.log(`  ${c.green("OK ")} ${msg}`);
}
export function warn(msg: string) {
  console.log(`  ${c.yellow("!! ")} ${msg}`);
}
export function fail(msg: string) {
  console.log(`  ${c.red("KO ")} ${msg}`);
}
export function info(msg: string) {
  console.log(`  ${c.dim(" - ")} ${msg}`);
}

/** Parse `--clé valeur`, `--clé=valeur` et `--flag` en objet. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const eq = key.indexOf("=");
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

export function str(v: string | boolean | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
export function num(v: string | boolean | undefined): number | undefined {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Liste les variables d'environnement manquantes parmi celles demandées. */
export function missingEnv(names: string[]): string[] {
  return names.filter((n) => !process.env[n]?.trim());
}

export async function runMain(main: () => Promise<number>) {
  try {
    const code = await main();
    process.exit(code);
  } catch (error) {
    fail(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exit(EXIT.FAILED);
  }
}

export async function disconnectPrisma() {
  const { prisma } = await import("../../src/lib/db");
  await prisma.$disconnect();
}

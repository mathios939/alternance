import type { ZodType } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("action");

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/** Parse une entrée avec Zod et retourne un ActionResult en cas d'échec. */
export function parseInput<S extends ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: S["_output"] } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, result: fail("Certains champs sont invalides.", fieldErrors) };
}

/** Enveloppe une action serveur : capture les erreurs, log, renvoie un ActionResult. */
export async function runAction<T>(scope: string, fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail("Tu dois être connecté pour effectuer cette action.");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail("Tu n'as pas accès à cette ressource.");
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return fail("Trop de requêtes. Réessaie dans quelques instants.");
    }
    log.error(`Échec de l'action ${scope}`, error);
    return fail("Une erreur inattendue est survenue. Réessaie.");
  }
}

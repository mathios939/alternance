import type { RawJob } from "@/services/job-sources/types";

/**
 * VALIDATION (étape 2 du pipeline) : une offre brute est acceptée seulement si elle
 * contient le minimum pour être présentée honnêtement. Sinon elle est rejetée avec un code.
 */
export type RejectCode = "MISSING_ID" | "MISSING_TITLE" | "SHORT_DESCRIPTION" | "MISSING_LOCATION" | "INVALID_DATE" | "TOO_OLD" | "NOT_ALTERNANCE";

export type ValidationResult = { ok: true; warnings: string[] } | { ok: false; code: RejectCode; reason: string };

export const VALIDATION_RULES = {
  minTitleLength: 3,
  minDescriptionLength: 40,
  maxAgeDays: 365,
  futureToleranceHours: 24,
} as const;

const ALTERNANCE_RE = /alternan|apprenti|apprentissage|professionnalisation|contrat pro\b/i;

export function validateRawJob(raw: RawJob, ctx: { now?: Date } = {}): ValidationResult {
  const now = ctx.now ?? new Date();
  const warnings: string[] = [];
  if (!raw.externalId?.trim()) return { ok: false, code: "MISSING_ID", reason: "Identifiant externe absent" };
  if (!raw.title || raw.title.trim().length < VALIDATION_RULES.minTitleLength) return { ok: false, code: "MISSING_TITLE", reason: "Titre absent ou trop court" };
  if (!raw.description || raw.description.trim().length < VALIDATION_RULES.minDescriptionLength) return { ok: false, code: "SHORT_DESCRIPTION", reason: "Description absente ou trop courte" };
  const hasCoords = typeof raw.latitude === "number" && typeof raw.longitude === "number";
  if (!raw.city?.trim() && !raw.postalCode && !hasCoords) return { ok: false, code: "MISSING_LOCATION", reason: "Aucune localisation exploitable" };
  if (!(raw.publishedAt instanceof Date) || Number.isNaN(raw.publishedAt.getTime())) return { ok: false, code: "INVALID_DATE", reason: "Date de publication invalide" };
  const ageDays = (now.getTime() - raw.publishedAt.getTime()) / 86_400_000;
  if (ageDays > VALIDATION_RULES.maxAgeDays) return { ok: false, code: "TOO_OLD", reason: `Publiée il y a plus de ${VALIDATION_RULES.maxAgeDays} jours` };
  if (ageDays < -VALIDATION_RULES.futureToleranceHours / 24) return { ok: false, code: "INVALID_DATE", reason: "Date de publication dans le futur" };
  if (raw.isAlternance === false) return { ok: false, code: "NOT_ALTERNANCE", reason: "La source indique que ce n'est pas une alternance" };
  if (raw.isAlternance !== true && !raw.contractType && !ALTERNANCE_RE.test(`${raw.title}\n${raw.description}`)) {
    return { ok: false, code: "NOT_ALTERNANCE", reason: "Aucune mention d'alternance ou d'apprentissage" };
  }
  if (!raw.companyName?.trim()) warnings.push("Employeur non communiqué");
  if (!hasCoords) warnings.push("Coordonnées absentes (localisation par ville)");
  return { ok: true, warnings };
}

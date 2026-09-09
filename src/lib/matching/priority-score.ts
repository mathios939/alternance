import { clamp } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────
 * OPPORTUNITY PRIORITY SCORE — classe les opportunités à traiter.
 *
 * Facteurs (total 100) :
 *   matchScore 40 · récence 20 · distance 15 ·
 *   concurrence estimée 10 · intérêt du candidat 10 · pertinence entreprise 5
 * ─────────────────────────────────────────────────────────────
 */
export type PriorityInput = {
  matchScore: number;
  publishedAt: Date;
  distanceKm: number | null;
  maxRadiusKm: number;
  /** Estimation de concurrence : 0 (faible) → 100 (forte). */
  competitionEstimate: number;
  /** Intérêt manifesté : favori, vues, etc. 0 → 100. */
  candidateInterest: number;
  /** Pertinence entreprise (secteur souhaité, alternants…). 0 → 100. */
  companyRelevance: number;
  now?: Date;
};

export const PRIORITY_WEIGHTS = {
  matchScore: 40,
  recency: 20,
  distance: 15,
  competition: 10,
  interest: 10,
  companyRelevance: 5,
} as const;

export function recencyScore(publishedAt: Date, now = new Date()): number {
  const hours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (hours <= 24) return 100;
  if (hours <= 72) return 85;
  if (hours <= 168) return 65;
  if (hours <= 720) return 40;
  return 15;
}

export function distanceScore(distanceKm: number | null, maxRadiusKm: number): number {
  if (distanceKm === null) return 60;
  const r = Math.max(maxRadiusKm, 5);
  if (distanceKm <= r * 0.34) return 100;
  if (distanceKm <= r * 0.67) return 85;
  if (distanceKm <= r) return 65;
  if (distanceKm <= r * 1.5) return 35;
  return 10;
}

/**
 * Estime la concurrence sur une offre (0 → 100).
 * Heuristique documentée : grande entreprise + grande ville + offre ancienne = plus de candidats.
 */
export function estimateCompetition(input: { companySize: "TPE" | "PME" | "ETI" | "GE"; cityPopulation?: number; hoursSincePublished: number; remote?: "NONE" | "HYBRID" | "FULL" | "UNKNOWN" }): number {
  let c = { TPE: 20, PME: 35, ETI: 55, GE: 75 }[input.companySize];
  if ((input.cityPopulation ?? 0) > 500_000) c += 15;
  else if ((input.cityPopulation ?? 0) > 150_000) c += 8;
  if (input.remote === "FULL") c += 15;
  if (input.hoursSincePublished > 168) c += 10;
  return clamp(c, 0, 100);
}

export function calculateOpportunityPriorityScore(input: PriorityInput): number {
  const now = input.now ?? new Date();
  const score =
    (input.matchScore * PRIORITY_WEIGHTS.matchScore +
      recencyScore(input.publishedAt, now) * PRIORITY_WEIGHTS.recency +
      distanceScore(input.distanceKm, input.maxRadiusKm) * PRIORITY_WEIGHTS.distance +
      (100 - input.competitionEstimate) * PRIORITY_WEIGHTS.competition +
      input.candidateInterest * PRIORITY_WEIGHTS.interest +
      input.companyRelevance * PRIORITY_WEIGHTS.companyRelevance) /
    100;
  return clamp(Math.round(score), 0, 100);
}

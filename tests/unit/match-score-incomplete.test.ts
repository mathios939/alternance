import { describe, expect, it } from "vitest";
import { calculateMatchScore, MATCH_WEIGHTS } from "@/lib/matching/match-score";
import { makeCandidate, makeJob } from "./helpers";

/**
 * Phase 20 : le Match Score doit rester juste quand l'offre réelle est incomplète.
 * UNKNOWN ≠ incompatible : un critère absent est exclu du calcul, jamais pénalisé.
 */
describe("Match Score — données d'offre incomplètes", () => {
  const candidate = makeCandidate({ educationLevel: "BAC2", skills: ["react", "node-js"], rhythm: "THREE_TWO", remotePreference: "HYBRID" });

  it("n'exclut pas une offre sans niveau d'études : critère retiré, score renormalisé", () => {
    const unknown = calculateMatchScore(candidate, makeJob({ educationLevelMin: null, educationLevelMax: null }));
    expect(unknown.unknownCriteria).toContain("education");
    // Le total est la moyenne pondérée des seuls critères connus
    const keys = (Object.keys(MATCH_WEIGHTS) as (keyof typeof MATCH_WEIGHTS)[]).filter((k) => k !== "education");
    const expected = Math.round(keys.reduce((sum, k) => sum + unknown.breakdown[k] * MATCH_WEIGHTS[k], 0) / keys.reduce((sum, k) => sum + MATCH_WEIGHTS[k], 0));
    expect(unknown.total).toBe(expected);
    const incompatible = calculateMatchScore(candidate, makeJob({ educationLevelMin: "BAC5", educationLevelMax: "BAC5" }));
    expect(unknown.total).toBeGreaterThan(incompatible.total);
    expect(unknown.reasons.some((r) => r.kind === "warning" && r.label.includes("Niveau"))).toBe(false);
  });

  it("ne pénalise pas un télétravail non précisé", () => {
    const unknown = calculateMatchScore(candidate, makeJob({ remote: "UNKNOWN" }));
    const onSite = calculateMatchScore(candidate, makeJob({ remote: "NONE" }));
    expect(unknown.breakdown.mobility).toBeGreaterThanOrEqual(onSite.breakdown.mobility);
    expect(unknown.reasons.some((r) => r.label.includes("Télétravail non précisé"))).toBe(true);
  });

  it("gère salary null, skills vides, rythme et durée nuls sans erreur ni pénalité artificielle", () => {
    const sparse = makeJob({ skills: [], requiredSkills: [], rhythm: null, durationMonths: null, educationLevelMin: null, educationLevelMax: null, remote: "UNKNOWN" });
    const result = calculateMatchScore(candidate, sparse);
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.unknownCriteria).toEqual(expect.arrayContaining(["education", "rhythm"]));
    // Le métier compatible et la localisation portent le score : il reste bon
    expect(result.total).toBeGreaterThanOrEqual(70);
  });

  it("marque le lieu comme inconnu seulement quand l'offre n'a ni ville ni coordonnées", () => {
    const noPlace = makeJob({ city: "", department: null, region: null, latitude: null, longitude: null });
    const result = calculateMatchScore(candidate, noPlace);
    expect(result.unknownCriteria).toContain("location");
    expect(result.distanceKm).toBeNull();
  });

  it("un score sur critères connus uniquement reste comparable entre offres complètes et incomplètes", () => {
    const complete = calculateMatchScore(candidate, makeJob());
    const partial = calculateMatchScore(candidate, makeJob({ rhythm: null, durationMonths: null }));
    expect(Math.abs(complete.total - partial.total)).toBeLessThanOrEqual(8);
  });
});

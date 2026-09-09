import { describe, expect, it } from "vitest";
import { calculateOpportunityScore, calculateOpportunityPriorityScore, estimateCompetition, recencyScore } from "@/lib/matching";
import { makeCandidate, makeCompany, rennes } from "./helpers";

describe("calculateOpportunityScore", () => {
  it("classe une PME tech proche qui accueille des alternants comme 'hot'", () => {
    const result = calculateOpportunityScore(makeCandidate(), makeCompany());
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe("hot");
    expect(result.isEstimate).toBe(true);
    expect(result.reasons.some((r) => r.label.includes("alternants"))).toBe(true);
  });

  it("baisse le score pour une entreprise lointaine d'un autre secteur", () => {
    const result = calculateOpportunityScore(
      makeCandidate(),
      makeCompany({ latitude: rennes.lat, longitude: rennes.lng, sector: "construction", jobFamilies: ["project"], technologies: [], hiresApprentices: false }),
    );
    expect(result.score).toBeLessThan(45);
    expect(result.level).toBe("cool");
  });

  it("récompense les offres en cours", () => {
    const without = calculateOpportunityScore(makeCandidate(), makeCompany({ activeJobsCount: 0, isHiring: false }));
    const withJobs = calculateOpportunityScore(makeCandidate(), makeCompany({ activeJobsCount: 2 }));
    expect(withJobs.score).toBeGreaterThan(without.score);
  });
});

describe("priorité des opportunités", () => {
  it("la récence décroît avec le temps", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
    expect(recencyScore(h(2), now)).toBe(100);
    expect(recencyScore(h(48), now)).toBe(85);
    expect(recencyScore(h(100), now)).toBe(65);
    expect(recencyScore(h(500), now)).toBe(40);
    expect(recencyScore(h(1000), now)).toBe(15);
  });

  it("estime plus de concurrence dans une grande entreprise en grande ville", () => {
    const small = estimateCompetition({ companySize: "TPE", cityPopulation: 20_000, hoursSincePublished: 5, remote: "NONE" });
    const big = estimateCompetition({ companySize: "GE", cityPopulation: 2_000_000, hoursSincePublished: 300, remote: "FULL" });
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(100);
  });

  it("classe d'abord une offre récente, proche et très compatible", () => {
    const base = { maxRadiusKm: 30, competitionEstimate: 40, candidateInterest: 0, companyRelevance: 50 };
    const top = calculateOpportunityPriorityScore({ ...base, matchScore: 92, publishedAt: new Date(), distanceKm: 4 });
    const meh = calculateOpportunityPriorityScore({ ...base, matchScore: 60, publishedAt: new Date(Date.now() - 40 * 86_400_000), distanceKm: 60 });
    expect(top).toBeGreaterThan(meh);
    expect(top).toBeGreaterThanOrEqual(80);
  });
});


describe("OpportunityScore — données d'entreprise inconnues (Phase 10)", () => {
  it("traite un historique d'alternance inconnu comme neutre, pas comme négatif", () => {
    const candidate = makeCandidate();
    const knownNo = calculateOpportunityScore(candidate, makeCompany({ hiresApprentices: false, historyKnown: true }));
    const unknown = calculateOpportunityScore(candidate, makeCompany({ hiresApprentices: false, historyKnown: false }));
    const knownYes = calculateOpportunityScore(candidate, makeCompany({ hiresApprentices: true, historyKnown: true }));
    expect(unknown.score).toBeGreaterThan(knownNo.score);
    expect(unknown.score).toBeLessThan(knownYes.score);
    expect(unknown.unknownFactors).toContain("historique d'alternance");
    expect(unknown.isEstimate).toBe(true);
  });

  it("ne pénalise pas une taille non renseignée", () => {
    const candidate = makeCandidate();
    const tpeKnown = calculateOpportunityScore(candidate, makeCompany({ size: "TPE", sizeKnown: true }));
    const unknownSize = calculateOpportunityScore(candidate, makeCompany({ size: "TPE", sizeKnown: false }));
    expect(unknownSize.score).toBeGreaterThanOrEqual(tpeKnown.score);
    expect(unknownSize.unknownFactors).toContain("taille");
  });
});

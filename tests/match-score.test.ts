import { describe, expect, it } from "vitest";
import { calculateMatchScore, MATCH_WEIGHTS } from "@/lib/matching";
import { makeCandidate, makeJob, rennes } from "./helpers";

describe("calculateMatchScore", () => {
  it("donne un excellent score à un profil parfaitement aligné", () => {
    const result = calculateMatchScore(makeCandidate(), makeJob());
    expect(result.total).toBeGreaterThanOrEqual(85);
    expect(result.level).toBe("excellent");
    expect(result.breakdown.education).toBe(100);
    expect(result.breakdown.location).toBe(100);
    expect(result.matchedSkills).toEqual(expect.arrayContaining(["react", "typescript", "node-js", "sql"]));
    expect(result.missingSkills).toEqual(["python"]);
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.distanceKm).toBeLessThan(10);
  });

  it("les pondérations totalisent 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("explique les compétences manquantes dans les avertissements", () => {
    const result = calculateMatchScore(makeCandidate(), makeJob());
    const warning = result.reasons.find((r) => r.kind === "warning" && r.label.includes("Python"));
    expect(warning).toBeDefined();
  });

  it("pénalise un niveau d'études trop bas", () => {
    const low = calculateMatchScore(makeCandidate({ educationLevel: "BAC" }), makeJob({ educationLevelMin: "BAC3" }));
    const ok = calculateMatchScore(makeCandidate({ educationLevel: "BAC3" }), makeJob({ educationLevelMin: "BAC3" }));
    expect(low.breakdown.education).toBeLessThan(ok.breakdown.education);
    expect(low.breakdown.education).toBeLessThanOrEqual(30);
  });

  it("reste neutre quand le candidat n'a pas renseigné son niveau", () => {
    const result = calculateMatchScore(makeCandidate({ educationLevel: null }), makeJob());
    expect(result.breakdown.education).toBe(50);
    expect(result.reasons.some((r) => r.label.includes("niveau"))).toBe(true);
  });

  it("pénalise fortement une offre hors rayon sans mobilité", () => {
    const far = calculateMatchScore(makeCandidate(), makeJob({ latitude: rennes.lat, longitude: rennes.lng, city: "Rennes", region: "Bretagne", department: "Ille-et-Vilaine" }));
    expect(far.breakdown.location).toBeLessThanOrEqual(15);
    expect(far.distanceKm).toBeGreaterThan(90);
  });

  it("ne pénalise pas la distance en télétravail complet", () => {
    const result = calculateMatchScore(makeCandidate(), makeJob({ remote: "FULL", latitude: rennes.lat, longitude: rennes.lng }));
    expect(result.breakdown.location).toBe(100);
  });

  it("accepte une offre lointaine si le candidat est mobile partout", () => {
    const result = calculateMatchScore(makeCandidate({ mobility: "NATIONAL" }), makeJob({ latitude: 48.8566, longitude: 2.3522, city: "Paris", region: "Île-de-France" }));
    expect(result.breakdown.location).toBe(60);
  });

  it("gère l'absence de coordonnées par zones", () => {
    const sameCity = calculateMatchScore(makeCandidate({ latitude: null, longitude: null }), makeJob({ latitude: null, longitude: null, city: "Nantes" }));
    const sameRegion = calculateMatchScore(makeCandidate({ latitude: null, longitude: null }), makeJob({ latitude: null, longitude: null, city: "Angers", department: "Maine-et-Loire" }));
    expect(sameCity.breakdown.location).toBe(90);
    expect(sameRegion.breakdown.location).toBeLessThan(sameCity.breakdown.location);
  });

  it("récompense les compétences requises plus que les optionnelles", () => {
    const withRequired = calculateMatchScore(makeCandidate({ skills: ["react", "typescript"] }), makeJob());
    const withOptional = calculateMatchScore(makeCandidate({ skills: ["python", "sql"] }), makeJob());
    expect(withRequired.breakdown.skills).toBeGreaterThan(withOptional.breakdown.skills);
  });

  it("signale un rythme incompatible", () => {
    const result = calculateMatchScore(makeCandidate({ rhythm: "ONE_ONE_WEEK" }), makeJob({ rhythm: "TWO_THREE" }));
    const compatible = calculateMatchScore(makeCandidate({ rhythm: "TWO_THREE" }), makeJob({ rhythm: "TWO_THREE" }));
    expect(result.breakdown.rhythm).toBeLessThan(70);
    expect(result.breakdown.rhythm).toBeLessThan(compatible.breakdown.rhythm - 30);
    expect(result.reasons.some((r) => r.kind === "warning" && r.label.includes("rythme"))).toBe(true);
  });

  it("pénalise une offre sur site pour un candidat 100 % télétravail", () => {
    const result = calculateMatchScore(makeCandidate({ remotePreference: "FULL" }), makeJob({ remote: "NONE" }));
    expect(result.breakdown.mobility).toBeLessThanOrEqual(55);
  });

  it("borne toujours le score entre 0 et 100", () => {
    const worst = calculateMatchScore(
      makeCandidate({ educationLevel: "CAP", skills: [], jobFamily: "hr", remotePreference: "FULL", rhythm: "ONE_ONE_WEEK", mobility: "CITY", experienceMonths: 0 }),
      makeJob({ educationLevelMin: "BAC5", latitude: 43.2965, longitude: 5.3698, city: "Marseille", region: "PACA", remote: "NONE" }),
    );
    expect(worst.total).toBeGreaterThanOrEqual(0);
    expect(worst.total).toBeLessThan(40);
    expect(worst.level).toBe("low");
  });
});

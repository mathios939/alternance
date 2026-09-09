import { describe, expect, it } from "vitest";
import { duplicateConfidenceScore, findCanonical, DUPLICATE_THRESHOLD, type DedupeCandidate } from "@/services/job-sources";

const base: DedupeCandidate = {
  id: "a",
  title: "Développeur Full Stack (H/F) - Alternance",
  companyName: "Sopra Steria",
  city: "Nantes",
  description:
    "Au sein de notre agence nantaise, vous rejoignez une équipe de 12 développeurs pour concevoir des applications web en React et Node.js pour nos clients du secteur bancaire. Vous participerez aux cérémonies agiles, à la revue de code et aux tests automatisés.",
  sourceUrl: "https://careers.example.com/jobs/1234?utm_source=linkedin",
  publishedAt: new Date("2026-09-01"),
};

describe("duplicateConfidenceScore", () => {
  it("détecte une URL identique malgré les paramètres de tracking", () => {
    const b = { ...base, id: "b", sourceUrl: "https://www.careers.example.com/jobs/1234/?utm_campaign=x", title: "Autre titre" };
    expect(duplicateConfidenceScore(base, b).confidence).toBe(100);
  });

  it("détecte la même offre reprise par un autre site", () => {
    const b: DedupeCandidate = {
      ...base,
      id: "b",
      title: "Développeur Full Stack H/F – Alternance",
      companyName: "SOPRA STERIA SAS",
      sourceUrl: "https://autre-site.fr/offre/98",
      description: base.description.replace("12 développeurs", "12 développeurs expérimentés"),
      publishedAt: new Date("2026-09-03"),
    };
    const verdict = duplicateConfidenceScore(base, b);
    expect(verdict.isDuplicate).toBe(true);
    expect(verdict.confidence).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
    expect(verdict.signals).toContain("Même entreprise");
  });

  it("ne confond pas deux offres différentes de la même entreprise", () => {
    const b: DedupeCandidate = {
      ...base,
      id: "b",
      title: "Alternance Contrôleur de gestion",
      sourceUrl: "https://careers.example.com/jobs/777",
      description: "Rattaché au DAF, vous participez aux clôtures mensuelles, au reporting et au budget prévisionnel de l'agence.",
    };
    expect(duplicateConfidenceScore(base, b).isDuplicate).toBe(false);
  });

  it("plafonne le score si l'entreprise diffère", () => {
    const b: DedupeCandidate = { ...base, id: "b", companyName: "Capgemini", sourceUrl: null };
    const verdict = duplicateConfidenceScore(base, b);
    expect(verdict.confidence).toBeLessThanOrEqual(55);
    expect(verdict.isDuplicate).toBe(false);
  });

  it("retrouve la version canonique parmi des offres existantes", () => {
    const other: DedupeCandidate = { ...base, id: "canon", sourceUrl: "https://x.fr/1", publishedAt: new Date("2026-08-30") };
    const unrelated: DedupeCandidate = { ...base, id: "u", title: "Assistant RH", description: "Paie, contrats, onboarding.", sourceUrl: null };
    const found = findCanonical({ ...base, id: "new", sourceUrl: null }, [unrelated, other]);
    expect(found?.match.id).toBe("canon");
  });
});

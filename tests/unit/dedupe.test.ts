import { describe, expect, it } from "vitest";
import { calculateDuplicateConfidence, canonicalUrl, DUPLICATE_THRESHOLDS, findCanonical, type DedupeCandidate } from "@/services/job-sources/dedupe";

const base: DedupeCandidate = {
  id: "a",
  title: "Développeur Full Stack (H/F) - Alternance",
  companyName: "Sopra Steria",
  city: "Nantes",
  postalCode: "44000",
  description:
    "Au sein de notre agence nantaise, vous rejoignez une équipe de 12 développeurs pour concevoir des applications web en React et Node.js pour nos clients du secteur bancaire. Vous participerez aux cérémonies agiles, à la revue de code et aux tests automatisés.",
  sourceUrl: "https://careers.example.com/jobs/1234?utm_source=linkedin",
  publishedAt: new Date("2026-09-01"),
  sourceKey: "company-career",
  externalId: "1234",
};

describe("calculateDuplicateConfidence (0-1)", () => {
  it("identifiant identique dans la même source = 1", () => {
    const v = calculateDuplicateConfidence(base, { ...base, id: "b", title: "Autre" });
    expect(v.confidence).toBe(1);
    expect(v.level).toBe("duplicate");
  });

  it("URL canonique identique malgré www, slash final et paramètres de tracking", () => {
    const b = { ...base, id: "b", sourceKey: "france-travail", externalId: "x", sourceUrl: "https://www.careers.example.com/jobs/1234/?utm_campaign=x&fbclid=1", title: "Autre titre" };
    const v = calculateDuplicateConfidence(base, b);
    expect(v.confidence).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLDS.duplicate);
    expect(v.signals).toContain("URL identique");
    expect(canonicalUrl("https://www.Example.com/a/?utm_x=1&b=2")).toBe("example.com/a?b=2");
  });

  it("même poste repris par une autre source → doublon automatique", () => {
    const b: DedupeCandidate = {
      ...base,
      id: "b",
      sourceKey: "france-travail",
      externalId: "FT1",
      title: "Développeur Full Stack H/F – Alternance",
      companyName: "SOPRA STERIA SAS",
      sourceUrl: "https://candidat.francetravail.fr/offres/recherche/detail/FT1",
      description: base.description.replace("12 développeurs", "12 développeurs expérimentés"),
      publishedAt: new Date("2026-09-03"),
    };
    const v = calculateDuplicateConfidence(base, b);
    expect(v.level).toBe("duplicate");
    expect(v.signals).toEqual(expect.arrayContaining(["Même entreprise", "Titre identique", "Même code postal"]));
  });

  it("même entreprise, même ville, description proche mais titre différent → probable, pas automatique", () => {
    const b: DedupeCandidate = {
      ...base,
      id: "b",
      sourceKey: "france-travail",
      externalId: "FT2",
      title: "Développeur Full Stack React (H/F) - Alternance",
      sourceUrl: null,
      description: "Au sein de notre agence nantaise, vous rejoignez une équipe de 12 développeurs pour concevoir des applications web en React et Node.js pour nos clients du secteur bancaire. Vous serez accompagné par un tuteur et formé aux bonnes pratiques de développement.",
      publishedAt: new Date("2026-09-02"),
    };
    const v = calculateDuplicateConfidence(base, b);
    expect(v.confidence).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLDS.probable);
    expect(v.confidence).toBeLessThan(DUPLICATE_THRESHOLDS.duplicate);
    expect(v.level).toBe("probable");
  });

  it("deux postes différents de la même entreprise restent distincts", () => {
    const b: DedupeCandidate = {
      ...base,
      id: "b",
      sourceKey: "france-travail",
      externalId: "FT3",
      title: "Alternance Contrôleur de gestion",
      sourceUrl: "https://careers.example.com/jobs/777",
      description: "Rattaché au DAF, vous participez aux clôtures mensuelles, au reporting et au budget prévisionnel de l'agence.",
    };
    expect(calculateDuplicateConfidence(base, b).level).toBe("distinct");
  });

  it("plafonne à 0,6 quand les entreprises connues diffèrent", () => {
    const b: DedupeCandidate = { ...base, id: "b", sourceKey: "france-travail", externalId: "FT4", companyName: "Capgemini", sourceUrl: null };
    const v = calculateDuplicateConfidence(base, b);
    expect(v.confidence).toBeLessThanOrEqual(0.6);
    expect(v.level).toBe("distinct");
  });

  it("employeur non communiqué : le titre et la description peuvent suffire, sans dépasser 0,9", () => {
    const b: DedupeCandidate = { ...base, id: "b", sourceKey: "france-travail", externalId: "FT5", companyName: "Employeur non communiqué", sourceUrl: null, publishedAt: new Date("2026-09-02") };
    const v = calculateDuplicateConfidence(base, b);
    expect(v.confidence).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLDS.probable);
    expect(v.confidence).toBeLessThanOrEqual(0.9);
  });

  it("un écart de publication de plus de 60 jours pénalise", () => {
    const near = calculateDuplicateConfidence(base, { ...base, id: "b", sourceKey: "ft", externalId: "1", sourceUrl: null, publishedAt: new Date("2026-09-02") });
    const far = calculateDuplicateConfidence(base, { ...base, id: "c", sourceKey: "ft", externalId: "2", sourceUrl: null, publishedAt: new Date("2026-05-01") });
    expect(far.confidence).toBeLessThan(near.confidence);
  });

  it("retrouve la version canonique parmi des offres existantes", () => {
    const other: DedupeCandidate = { ...base, id: "canon", sourceKey: "ft", externalId: "9", sourceUrl: "https://x.fr/1", publishedAt: new Date("2026-08-30") };
    const unrelated: DedupeCandidate = { ...base, id: "u", sourceKey: "ft", externalId: "10", title: "Assistant RH", description: "Paie, contrats, onboarding.", sourceUrl: null };
    const found = findCanonical({ ...base, id: "new", sourceKey: "ft", externalId: "11", sourceUrl: null }, [unrelated, other]);
    expect(found?.match.id).toBe("canon");
    expect(found?.verdict.level).toBe("duplicate");
  });
});

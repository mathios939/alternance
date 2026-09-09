import { describe, expect, it } from "vitest";
import { validateRawJob } from "@/services/ingestion/validate";
import { calculateJobDataQuality } from "@/services/ingestion/quality";
import { parsePersonLabel } from "@/services/ingestion/person-label";
import { mergeDataSources } from "@/services/ingestion/data-sources";
import type { RawJob } from "@/services/job-sources/types";

const now = new Date("2026-09-09T12:00:00Z");
const valid: RawJob = {
  externalId: "1",
  title: "Développeur web en alternance",
  companyName: "ACME",
  description: "Contrat d'apprentissage de 24 mois pour développer des applications web modernes avec une équipe expérimentée.",
  city: "Nantes",
  publishedAt: new Date("2026-09-01"),
  isAlternance: true,
};

describe("validateRawJob", () => {
  it("accepte une offre complète", () => {
    expect(validateRawJob(valid, { now }).ok).toBe(true);
  });
  it("rejette les offres sans identifiant, titre, description ou lieu", () => {
    expect(validateRawJob({ ...valid, externalId: " " }, { now })).toMatchObject({ ok: false, code: "MISSING_ID" });
    expect(validateRawJob({ ...valid, title: "Dé" }, { now })).toMatchObject({ ok: false, code: "MISSING_TITLE" });
    expect(validateRawJob({ ...valid, description: "trop court" }, { now })).toMatchObject({ ok: false, code: "SHORT_DESCRIPTION" });
    expect(validateRawJob({ ...valid, city: null }, { now })).toMatchObject({ ok: false, code: "MISSING_LOCATION" });
  });
  it("accepte des coordonnées comme localisation", () => {
    expect(validateRawJob({ ...valid, city: null, latitude: 47.2, longitude: -1.5 }, { now }).ok).toBe(true);
  });
  it("rejette les dates invalides, futures ou trop anciennes", () => {
    expect(validateRawJob({ ...valid, publishedAt: new Date("nope") }, { now })).toMatchObject({ ok: false, code: "INVALID_DATE" });
    expect(validateRawJob({ ...valid, publishedAt: new Date("2026-09-20") }, { now })).toMatchObject({ ok: false, code: "INVALID_DATE" });
    expect(validateRawJob({ ...valid, publishedAt: new Date("2025-01-01") }, { now })).toMatchObject({ ok: false, code: "TOO_OLD" });
  });
  it("rejette ce qui n'est pas une alternance, accepte une mention textuelle", () => {
    expect(validateRawJob({ ...valid, isAlternance: false }, { now })).toMatchObject({ ok: false, code: "NOT_ALTERNANCE" });
    expect(validateRawJob({ ...valid, isAlternance: null, title: "Développeur web", description: "Poste en CDI dans une équipe produit avec des responsabilités techniques variées." }, { now })).toMatchObject({ ok: false, code: "NOT_ALTERNANCE" });
    expect(validateRawJob({ ...valid, isAlternance: null, title: "Développeur web (apprentissage)" }, { now }).ok).toBe(true);
  });
});

describe("calculateJobDataQuality", () => {
  const full = { title: "Dev", description: "x".repeat(300), companyKnown: true, city: "Nantes", hasCoordinates: true, applicationUrl: "https://a.fr/apply", sourceKnown: true, publishedAt: new Date("2026-09-01"), lastVerifiedAt: now, educationLevelKnown: true, salaryKnown: true, durationKnown: true, skillsCount: 3 };
  it("note 100 une offre complète et vérifiée", () => {
    const q = calculateJobDataQuality(full, now);
    expect(q.score).toBe(100);
    expect(q.label).toBe("Données complètes");
    expect(q.missing).toEqual([]);
  });
  it("liste précisément ce qui manque", () => {
    const q = calculateJobDataQuality({ ...full, companyKnown: false, applicationUrl: null, lastVerifiedAt: null, description: "court" }, now);
    expect(q.missing).toEqual(expect.arrayContaining(["Entreprise identifiée", "Lien de candidature valide", "Vérifiée récemment (< 7 jours)", "Description suffisante"]));
    expect(q.label).toBe("Données partielles");
  });
  it("classe « insuffisantes » sous 50", () => {
    const q = calculateJobDataQuality({ ...full, companyKnown: false, applicationUrl: null, lastVerifiedAt: null, description: "court", hasCoordinates: false, city: null, sourceKnown: false }, now);
    expect(q.label).toBe("Données insuffisantes");
  });
});

describe("parsePersonLabel (contacts publiés dans les offres)", () => {
  it("reconnaît une personne avec civilité et fonction", () => {
    expect(parsePersonLabel("ATLANTIC SOFTWARE - Mme DURAND Camille - Responsable RH", "ATLANTIC SOFTWARE")).toBeNull(); // le premier segment est l'entreprise
    expect(parsePersonLabel("Mme DURAND Camille - Responsable RH", "ATLANTIC SOFTWARE")).toEqual({ displayName: "Mme DURAND Camille - Responsable RH", firstName: "Camille", lastName: "DURAND", jobTitle: "Responsable RH" });
    expect(parsePersonLabel("M. Jean Martin", null)).toEqual({ displayName: "M. Jean Martin", firstName: "Jean", lastName: "Martin", jobTitle: null });
  });
  it("refuse les organisations, les libellés ambigus et le nom de l'entreprise", () => {
    expect(parsePersonLabel("CABINET FIDUCIAIRE OUEST", null)).toBeNull();
    expect(parsePersonLabel("Service recrutement", null)).toBeNull();
    expect(parsePersonLabel("ATLANTIC SOFTWARE", "Atlantic Software")).toBeNull();
    expect(parsePersonLabel("contact@x.fr", null)).toBeNull();
    expect(parsePersonLabel("", null)).toBeNull();
  });
});

describe("mergeDataSources", () => {
  it("garde une entrée par source, la plus récente", () => {
    const merged = mergeDataSources([{ source: "france-travail", url: null, fetchedAt: "2026-01-01" }], { source: "france-travail", url: "https://x", fetchedAt: "2026-02-01" });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.fetchedAt).toBe("2026-02-01");
    expect(mergeDataSources("garbage", { source: "sirene", url: null, fetchedAt: "x" })).toHaveLength(1);
  });
});

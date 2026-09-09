import { describe, expect, it } from "vitest";
import { cleanCityLabel, ftOfferSchema, mapFtOffer, parseContractDuration, parseEducationLevel, parseSalary } from "@/services/job-sources/providers/france-travail";
import { normalizeJob } from "@/services/job-sources/normalize";
import { validateRawJob } from "@/services/ingestion/validate";
import { FT_OFFER_ANONYMOUS, FT_OFFER_FIXTURE } from "../fixtures/france-travail-offer";

describe("France Travail — normalisation", () => {
  it("mappe une offre complète sans rien inventer", () => {
    const parsed = ftOfferSchema.parse(FT_OFFER_FIXTURE);
    const raw = mapFtOffer(parsed);
    expect(raw.externalId).toBe("195ABCD");
    expect(raw.companyName).toBe("ATLANTIC SOFTWARE");
    expect(raw.city).toBe("Nantes");
    expect(raw.postalCode).toBe("44000");
    expect(raw.inseeCode).toBe("44109");
    expect(raw.department).toBe("Loire-Atlantique");
    expect(raw.region).toBe("Pays de la Loire");
    expect(raw.latitude).toBeCloseTo(47.218, 2);
    expect(raw.contractType).toBe("APPRENTISSAGE");
    expect(raw.isAlternance).toBe(true);
    expect(raw.educationLevelMin).toBe("BAC2");
    expect(raw.durationMonths).toBe(24);
    expect(raw.salaryMin).toBe(759);
    expect(raw.salaryMax).toBe(1766);
    expect(raw.salaryPeriod).toBe("MONTH");
    expect(raw.skills).toEqual(["React", "Node.js", "Concevoir une application web"]);
    expect(raw.applicationUrl).toBe("https://www.atlantic-software.example/carrieres/dev-web");
    expect(raw.applicationEmail).toBe("recrutement@atlantic-software.example");
    expect(raw.applicationLabel).toBe("ATLANTIC SOFTWARE - Mme DURAND Camille");
    expect(raw.sourceUrl).toContain("candidat.francetravail.fr/offres/recherche/detail/195ABCD");
    expect(raw.romeCode).toBe("M1805");
    expect(raw.nafCode).toBe("62.01Z");
    expect(raw.positionsCount).toBe(2);
    expect(raw.publishedAt.toISOString()).toBe("2026-09-01T08:15:00.000Z");
    expect(raw.remote).toBeNull();
  });

  it("laisse null ce que la source ne fournit pas (offre anonyme, salaire non chiffré)", () => {
    const raw = mapFtOffer(ftOfferSchema.parse(FT_OFFER_ANONYMOUS));
    expect(raw.companyName).toBeNull();
    expect(raw.latitude).toBeNull();
    expect(raw.salaryMin).toBeNull();
    expect(raw.salaryPeriod).toBeNull();
    expect(raw.contractType).toBe("PROFESSIONNALISATION");
    expect(raw.educationLevelMin).toBe("BAC");
    expect(raw.durationMonths).toBe(12);
    // Offre partenaire : le lien de candidature est celui de l'origine
    expect(raw.applicationUrl).toBe("https://www.partenaire-emploi.example/offre/xyz");
    expect(raw.applicationLabel).toBe("CABINET FIDUCIAIRE OUEST");
  });

  it("passe la validation puis la normalisation interne", () => {
    const raw = mapFtOffer(ftOfferSchema.parse(FT_OFFER_FIXTURE));
    const v = validateRawJob(raw, { now: new Date("2026-09-09") });
    expect(v.ok).toBe(true);
    const job = normalizeJob(raw, { key: "france-travail", type: "FRANCE_TRAVAIL", isDemo: false });
    expect(job.normalizedTitle).toBe("developpeur web");
    expect(job.companyNameNormalized).toBe("atlantic software");
    expect(job.rhythm).toBe("THREE_TWO");
    expect(job.jobFamily).toBe("dev");
    expect(job.skillSlugs).toContain("react");
    expect(job.isDemo).toBe(false);
  });

  it("rattache une offre anonyme à « Employeur non communiqué » sans inventer de nom", () => {
    const raw = mapFtOffer(ftOfferSchema.parse(FT_OFFER_ANONYMOUS));
    const job = normalizeJob(raw, { key: "france-travail", type: "FRANCE_TRAVAIL", isDemo: false });
    expect(job.companyNameRaw).toBeNull();
    expect(job.companyName).toBe("Employeur non communiqué");
    expect(job.city).toBe("Rennes");
    expect(job.latitude).not.toBeNull(); // coordonnées de la ville connue, pas de l'offre
  });

  it("tolère les champs inconnus et les identifiants numériques", () => {
    const parsed = ftOfferSchema.parse({ ...FT_OFFER_FIXTURE, id: 12345, champInconnu: { a: 1 } });
    expect(parsed.id).toBe("12345");
    expect((parsed as Record<string, unknown>)["champInconnu"]).toEqual({ a: 1 });
  });
});

describe("France Travail — parseurs", () => {
  it("analyse les libellés de salaire sans inventer", () => {
    expect(parseSalary("Mensuel de 759.00 Euros à 1766.00 Euros sur 12 mois")).toEqual({ min: 759, max: 1766, period: "MONTH" });
    expect(parseSalary("Annuel de 21 000,00 Euros")).toEqual({ min: 21000, max: 21000, period: "YEAR" });
    expect(parseSalary("Horaire de 11.88 Euros")).toEqual({ min: 12, max: 12, period: "HOUR" });
    expect(parseSalary("Selon profil")).toEqual({ min: null, max: null, period: null });
    expect(parseSalary("Mensuel de 43% à 100% du SMIC")).toEqual({ min: null, max: null, period: "MONTH" });
    expect(parseSalary(null)).toEqual({ min: null, max: null, period: null });
  });

  it("analyse les niveaux de formation", () => {
    expect(parseEducationLevel("Bac+2 ou équivalents")).toBe("BAC2");
    expect(parseEducationLevel("Bac+3, Bac+4 ou équivalents")).toBe("BAC3");
    expect(parseEducationLevel("Bac+5 et plus ou équivalents")).toBe("BAC5");
    expect(parseEducationLevel("Bac ou équivalent")).toBe("BAC");
    expect(parseEducationLevel("CAP, BEP et équivalents")).toBe("CAP");
    expect(parseEducationLevel("Aucune formation scolaire")).toBeNull();
  });

  it("analyse durée et libellé de ville", () => {
    expect(parseContractDuration("Contrat à durée déterminée - 24 Mois")).toBe(24);
    expect(parseContractDuration("Contrat à durée indéterminée")).toBeNull();
    expect(cleanCityLabel("44 - NANTES")).toBe("Nantes");
    expect(cleanCityLabel("85 - LA ROCHE SUR YON")).toBe("La Roche-sur-Yon");
    expect(cleanCityLabel("29 - PLOUGASTEL DAOULAS")).toBe("Plougastel Daoulas");
    expect(cleanCityLabel(null)).toBeNull();
  });
});

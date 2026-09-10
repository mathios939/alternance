import { describe, expect, it } from "vitest";
import {
  isFranceTravailRelay,
  isInactiveStatus,
  lbaDepartmentCode,
  lbaExternalId,
  lbaOfferSchema,
  mapLbaOffer,
  parseAddress,
  parseContractType,
  parseRemote,
} from "@/services/job-sources/providers/la-bonne-alternance";
import { normalizeJob } from "@/services/job-sources/normalize";
import { validateRawJob } from "@/services/ingestion/validate";
import {
  LBA_OFFER_FIXTURE,
  LBA_OFFER_FRANCE_TRAVAIL,
  LBA_OFFER_PARTNER_MINIMAL,
} from "../fixtures/la-bonne-alternance-offer";

describe("La bonne alternance — normalisation", () => {
  it("mappe une offre complète sans rien inventer", () => {
    const raw = mapLbaOffer(lbaOfferSchema.parse(LBA_OFFER_FIXTURE));
    expect(raw.externalId).toBe("6687165396d52b5e01b409545");
    expect(raw.title).toBe("Développeur / Développeuse web en alternance");
    expect(raw.companyName).toBe("ATLANTIC SOFTWARE");
    expect(raw.companyWebsite).toBe("https://www.atlantic-software.example");
    expect(raw.city).toBe("Nantes");
    expect(raw.postalCode).toBe("44000");
    expect(raw.inseeCode).toBeNull();
    expect(raw.department).toBe("Loire-Atlantique");
    expect(raw.region).toBe("Pays de la Loire");
    // GeoJSON : [longitude, latitude]
    expect(raw.latitude).toBeCloseTo(47.218, 2);
    expect(raw.longitude).toBeCloseTo(-1.553, 2);
    expect(raw.contractType).toBe("APPRENTISSAGE");
    expect(raw.isAlternance).toBe(true);
    expect(raw.durationMonths).toBe(24);
    expect(raw.remote).toBe("HYBRID");
    expect(raw.startDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(raw.publishedAt.toISOString()).toBe("2026-09-01T08:15:00.000Z");
    expect(raw.expiresAt?.toISOString()).toBe("2026-11-30T23:59:59.000Z");
    expect(raw.applicationUrl).toContain("labonnealternance.apprentissage.beta.gouv.fr");
    expect(raw.sourceUrl).toBe(raw.applicationUrl);
    expect(raw.skills).toEqual(["Faire preuve de rigueur et de précision", "Travailler en équipe"]);
    expect(raw.missions).toEqual(["Concevoir et développer une solution digitale"]);
    expect(raw.requirements).toEqual([
      "Ce métier est accessible avec un diplôme de niveau Bac+2 à Bac+5 en informatique.",
      "Diplôme visé : Licence, Bachelor, BUT (niveau 6)",
    ]);
    // Le niveau n'est jamais déduit du diplôme visé : seule la mention textuelle compte.
    expect(raw.educationLevelMin).toBeNull();
    expect(raw.educationLevelMax).toBeNull();
    expect(raw.salaryMin).toBeUndefined();
    expect(raw.romeCode).toBe("M1805");
    expect(raw.nafCode).toBe("62.01Z");
    expect(raw.positionsCount).toBe(2);
    expect(raw.applicationEmail).toBeNull();
    expect(raw.updatedAt).toBeNull();
  });

  it("laisse null ce que la source ne fournit pas (partenaire minimal)", () => {
    const raw = mapLbaOffer(lbaOfferSchema.parse(LBA_OFFER_PARTNER_MINIMAL));
    expect(raw.externalId).toBe("77a1165396d52b5e01b40aaaa");
    expect(raw.companyName).toBe("BRETAGNE BÂTIMENT");
    expect(raw.city).toBe("Rennes");
    expect(raw.postalCode).toBe("35000");
    expect(raw.department).toBe("Ille-et-Vilaine");
    expect(raw.latitude).toBeNull();
    expect(raw.longitude).toBeNull();
    expect(raw.contractType).toBe("PROFESSIONNALISATION");
    expect(raw.durationMonths).toBeNull();
    expect(raw.remote).toBeNull();
    expect(raw.startDate).toBeNull();
    expect(raw.expiresAt).toBeNull();
    expect(raw.description).toBe("");
    expect(raw.romeCode).toBeNull();
    expect(raw.nafCode).toBeNull();
    expect(raw.positionsCount).toBe(1);
    // Sans description : rejetée par la validation (jamais complétée artificiellement).
    expect(validateRawJob(raw, { now: new Date("2026-09-10T12:00:00Z") }).ok).toBe(false);
  });

  it("passe la validation puis la normalisation commune", () => {
    const raw = mapLbaOffer(lbaOfferSchema.parse(LBA_OFFER_FIXTURE));
    expect(validateRawJob(raw, { now: new Date("2026-09-10T12:00:00Z") }).ok).toBe(true);
    const job = normalizeJob(raw, { key: "la-bonne-alternance", type: "PARTNER", isDemo: false });
    expect(job.source).toBe("PARTNER");
    expect(job.sourceKey).toBe("la-bonne-alternance");
    expect(job.city).toBe("Nantes");
    expect(job.contractType).toBe("APPRENTISSAGE");
    expect(job.remote).toBe("HYBRID");
    expect(job.applicationUrl).toBe(raw.applicationUrl);
    expect(job.skillSlugs.length).toBeGreaterThan(0);
  });

  it("reconnaît les offres relayées de France Travail et les offres inactives", () => {
    expect(isFranceTravailRelay(lbaOfferSchema.parse(LBA_OFFER_FRANCE_TRAVAIL))).toBe(true);
    expect(isFranceTravailRelay(lbaOfferSchema.parse(LBA_OFFER_FIXTURE))).toBe(false);
    expect(isFranceTravailRelay({ identifier: { partner_label: "Pôle emploi" } })).toBe(true);
    expect(isInactiveStatus({ offer: { status: "Filled" } })).toBe(true);
    expect(isInactiveStatus({ offer: { status: "Cancelled" } })).toBe(true);
    expect(isInactiveStatus({ offer: { status: "Active" } })).toBe(false);
    expect(isInactiveStatus({ offer: {} })).toBe(false);
  });

  it("construit un identifiant stable même sans identifiant La bonne alternance", () => {
    expect(lbaExternalId(lbaOfferSchema.parse(LBA_OFFER_FRANCE_TRAVAIL))).toBe(
      "France Travail:195ABCD",
    );
    expect(lbaExternalId({ identifier: { id: " abc ", partner_job_id: "x" } })).toBe("abc");
    expect(lbaExternalId({ identifier: { partner_job_id: "x" } })).toBe("x");
    expect(lbaExternalId({ identifier: null })).toBe("");
  });

  it("lit l'adresse postale et le département sans deviner", () => {
    expect(parseAddress("20 AVENUE DE SEGUR 75007 PARIS")).toEqual({
      postalCode: "75007",
      city: "Paris",
    });
    // Commune connue : libellé canonique (accents, trait d'union) retrouvé dans src/config/cities.ts.
    expect(parseAddress("ZA DES LANDES 35510 CESSON SEVIGNE CEDEX 2")).toEqual({
      postalCode: "35510",
      city: "Cesson-Sévigné",
    });
    expect(parseAddress("BP 12345 44000 NANTES")).toEqual({ postalCode: "44000", city: "Nantes" });
    expect(parseAddress("10 RUE X 75007 PARIS 07")).toEqual({ postalCode: "75007", city: "Paris" });
    expect(parseAddress("20000 AJACCIO").postalCode).toBe("20000");
    expect(parseAddress("97400 SAINT-DENIS").postalCode).toBe("97400");
    expect(parseAddress("Télétravail")).toEqual({ postalCode: null, city: null });
    expect(parseAddress(null)).toEqual({ postalCode: null, city: null });
    expect(lbaDepartmentCode(lbaOfferSchema.parse(LBA_OFFER_FIXTURE))).toBe("44");
    expect(lbaDepartmentCode({ workplace: { location: { address: "97400 SAINT-DENIS" } } })).toBe(
      "974",
    );
    expect(lbaDepartmentCode({ workplace: null })).toBeNull();
  });

  it("traduit le mode de travail et le type de contrat", () => {
    expect(parseRemote("onsite")).toBe("NONE");
    expect(parseRemote("remote")).toBe("FULL");
    expect(parseRemote("hybrid")).toBe("HYBRID");
    expect(parseRemote(null)).toBeNull();
    expect(parseContractType(["Apprentissage", "Professionnalisation"])).toBe("APPRENTISSAGE");
    expect(parseContractType(["Professionnalisation"])).toBe("PROFESSIONNALISATION");
    expect(parseContractType([])).toBeNull();
    expect(parseContractType(null)).toBeNull();
  });

  it("tolère les champs inconnus et les valeurs nulles du schéma", () => {
    const parsed = lbaOfferSchema.safeParse({
      identifier: { id: "x1", partner_label: "offres_emploi_lba", extra: true },
      offer: { title: "Titre", publication: { creation: "pas une date" } },
    });
    expect(parsed.success).toBe(true);
    const raw = mapLbaOffer(parsed.data!);
    expect(Number.isNaN(raw.publishedAt.getTime())).toBe(true);
    expect(raw.city).toBeNull();
    expect(raw.companyName).toBeNull();
    expect(raw.applicationUrl).toBeNull();
  });
});

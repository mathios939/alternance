import { describe, expect, it } from "vitest";
import { recommendBestContact, type ContactForRecommendation } from "@/lib/matching";

const contact = (over: Partial<ContactForRecommendation>): ContactForRecommendation => ({
  id: "c",
  firstName: "Marie",
  lastName: "Dupont",
  jobTitle: "Talent Acquisition Specialist",
  department: null,
  confidenceScore: 80,
  verifiedAt: null,
  optOutAt: null,
  isDemo: true,
  ...over,
});

describe("recommendBestContact", () => {
  it("retourne null sans contact (jamais d'invention)", () => {
    expect(recommendBestContact({ size: "GE", name: "Orange", city: "Rennes" }, { jobFamily: "dev" }, [])).toBeNull();
  });

  it("exclut les contacts ayant exercé leur droit d'opposition", () => {
    const result = recommendBestContact({ size: "GE", name: "Orange", city: "Rennes" }, { jobFamily: "dev" }, [contact({ optOutAt: new Date() })]);
    expect(result).toBeNull();
  });

  it("préfère les RH dans une grande entreprise", () => {
    const result = recommendBestContact({ size: "GE", name: "Orange", city: "Rennes" }, { jobFamily: "dev" }, [
      contact({ id: "hr", jobTitle: "Talent Acquisition Specialist" }),
      contact({ id: "ceo", firstName: "Paul", jobTitle: "Directeur Général" }),
      contact({ id: "lead", firstName: "Léa", jobTitle: "Tech Lead" }),
    ]);
    expect(result?.contact.id).toBe("hr");
    expect(result?.reason).toMatch(/recrute/);
  });

  it("préfère le manager métier dans une PME", () => {
    const result = recommendBestContact({ size: "PME", name: "Lengow", city: "Nantes" }, { jobFamily: "dev" }, [
      contact({ id: "hr", jobTitle: "Chargée RH" }),
      contact({ id: "lead", firstName: "Léa", jobTitle: "Lead Développeuse Web" }),
    ]);
    expect(result?.contact.id).toBe("lead");
  });

  it("préfère le dirigeant dans une TPE", () => {
    const result = recommendBestContact({ size: "TPE", name: "Studio", city: "Vannes" }, { jobFamily: "design" }, [
      contact({ id: "founder", firstName: "Nora", jobTitle: "Fondatrice" }),
      contact({ id: "hr", jobTitle: "Assistante RH" }),
    ]);
    expect(result?.contact.id).toBe("founder");
    expect(result?.reason).toMatch(/TPE/);
  });
});

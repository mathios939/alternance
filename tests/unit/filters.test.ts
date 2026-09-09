import { describe, expect, it } from "vitest";
import { jobFiltersSchema, matchesFilters, filtersToSearchParams, countActiveFilters } from "@/features/jobs/lib/filters";
import { parseNaturalQuery } from "@/features/jobs/lib/query-parser";

const job = {
  title: "Développeur web React — Alternance",
  description: "Vous développerez des interfaces en React et TypeScript.",
  city: "Nantes",
  department: "Loire-Atlantique",
  region: "Pays de la Loire",
  remote: "HYBRID" as const,
  contractType: "APPRENTISSAGE" as const,
  educationLevelMin: "BAC2" as const,
  educationLevelMax: "BAC5" as const,
  durationMonths: 24,
  publishedAt: new Date("2026-09-08T10:00:00Z"),
  sector: "tech",
  jobFamily: "dev",
  skillsText: ["React", "TypeScript"],
};
const now = new Date("2026-09-09T10:00:00Z");

describe("jobFiltersSchema", () => {
  it("parse des query params CSV et ignore les valeurs inconnues", () => {
    const f = jobFiltersSchema.parse({ levels: "BAC2,BAC3,FOO", remote: "HYBRID", radius: "25", durations: "12,99", published: "7d" });
    expect(f.levels).toEqual(["BAC2", "BAC3"]);
    expect(f.remote).toEqual(["HYBRID"]);
    expect(f.radius).toBeUndefined();
    expect(f.durations).toEqual([12]);
    expect(f.published).toBe("7d");
    expect(f.page).toBe(1);
  });

  it("sérialise et re-parse sans perte", () => {
    const f = jobFiltersSchema.parse({ q: "dev", city: "Nantes", radius: 30, levels: ["BAC3"], sort: "recent", page: 2 });
    const params = filtersToSearchParams(f);
    const again = jobFiltersSchema.parse(Object.fromEntries(params));
    expect(again).toEqual(f);
    expect(countActiveFilters(f)).toBe(3);
  });
});

describe("matchesFilters", () => {
  it("filtre par texte, niveau, télétravail et fraîcheur", () => {
    expect(matchesFilters(job, jobFiltersSchema.parse({ q: "react nantes" }), now)).toBe(false);
    expect(matchesFilters(job, jobFiltersSchema.parse({ q: "react typescript" }), now)).toBe(true);
    expect(matchesFilters(job, jobFiltersSchema.parse({ levels: "BAC3" }), now)).toBe(true);
    expect(matchesFilters(job, jobFiltersSchema.parse({ levels: "CAP" }), now)).toBe(false);
    expect(matchesFilters(job, jobFiltersSchema.parse({ remote: "FULL" }), now)).toBe(false);
    expect(matchesFilters(job, jobFiltersSchema.parse({ published: "24h" }), now)).toBe(true);
    expect(matchesFilters(job, jobFiltersSchema.parse({ published: "3h" }), now)).toBe(false);
    expect(matchesFilters(job, jobFiltersSchema.parse({ durations: "12" }), now)).toBe(false);
    expect(matchesFilters(job, jobFiltersSchema.parse({ sectors: "tech", families: "dev" }), now)).toBe(true);
  });
});

describe("parseNaturalQuery", () => {
  it("transforme une phrase complète en filtres", () => {
    const parsed = parseNaturalQuery("Alternance cybersécurité à Rennes Bac+3 dans un rayon de 30 km");
    expect(parsed.city).toBe("Rennes");
    expect(parsed.levels).toEqual(["BAC3"]);
    expect(parsed.radius).toBe(30);
    expect(parsed.q).toContain("cybersecurite");
  });

  it("comprend le télétravail, la durée et les villes composées", () => {
    const parsed = parseNaturalQuery("développeur web télétravail 24 mois Saint-Nazaire");
    expect(parsed.city).toBe("Saint-Nazaire");
    expect(parsed.remote).toEqual(["HYBRID", "FULL"]);
    expect(parsed.durations).toEqual([24]);
    expect(parsed.q).toBe("developpeur web");
  });

  it("reconnaît une région et un BTS", () => {
    const parsed = parseNaturalQuery("BTS SIO en Bretagne");
    expect(parsed.region).toBe("Bretagne");
    expect(parsed.levels).toEqual(["BAC2"]);
    expect(parsed.q).toContain("sio");
  });

  it("gère une requête simple", () => {
    const parsed = parseNaturalQuery("marketing");
    expect(parsed.q).toBe("marketing");
    expect(parsed.city).toBeUndefined();
  });
});

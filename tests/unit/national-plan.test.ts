import { describe, expect, it } from "vitest";
import {
  ALL_DEPARTMENT_CODES,
  departmentCodesOfRegion,
  isRegionName,
  REGIONS,
} from "@/config/departments";
import {
  describeChunk,
  initialChunk,
  MIN_CHUNK_MS,
  planTerritories,
  splitChunk,
  SYNC_WINDOWS,
} from "@/services/ingestion/national-plan";
import { liveSearchTarget, parseLiveKey } from "@/services/ingestion/live-search-key";
import { computeFreshness, describeSyncedAgo } from "@/lib/freshness";

describe("planTerritories", () => {
  it("couvre la France entière une seule fois, prioritaires puis zones demandées puis le reste", () => {
    const plan = planTerritories({ all: true });
    expect(plan).toHaveLength(ALL_DEPARTMENT_CODES.length);
    expect(new Set(plan).size).toBe(plan.length);
    expect(plan.slice(0, 9)).toEqual(["44", "49", "53", "72", "85", "35", "29", "56", "22"]);
    expect(plan[9]).toBe("75");
    expect(plan).toContain("2A");
    expect(plan).toContain("974");
  });
  it("résout les régions et ignore les codes inconnus", () => {
    expect(planTerritories({ regions: ["Pays de la Loire"] })).toEqual([
      "44",
      "49",
      "53",
      "72",
      "85",
    ]);
    expect(planTerritories({ regions: ["bretagne"] })).toEqual(["35", "29", "56", "22"]);
    expect(planTerritories({ departments: ["99", "44", "4"] })).toEqual(["44", "04"]);
    expect(departmentCodesOfRegion("Île-de-France")).toContain("75");
  });
  it("reconnaît un libellé de région (jamais lu comme un département)", () => {
    expect(isRegionName("Pays de la Loire")).toBe(true);
    expect(isRegionName("grand est")).toBe(true);
    expect(isRegionName("NANTES")).toBe(false);
    expect(REGIONS.length).toBeGreaterThanOrEqual(13);
  });
});

describe("découpe des morceaux", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("construit la fenêtre initiale", () => {
    const c = initialChunk("7d", now);
    expect(Date.parse(c.until) - Date.parse(c.since)).toBe(SYNC_WINDOWS["7d"] * 86_400_000);
    expect(c.natures).toBeUndefined();
  });
  it("découpe d'abord par nature de contrat, puis par moitiés, le plus récent d'abord", () => {
    const c = initialChunk("31d", now);
    const byNature = splitChunk(c, ["E2", "FS"]);
    expect(byNature.map((x) => x.natures)).toEqual([["E2"], ["FS"]]);
    const halves = splitChunk(byNature[0]!, ["E2", "FS"]);
    expect(halves).toHaveLength(2);
    expect(halves[0]!.until).toBe(c.until);
    expect(halves[1]!.since).toBe(c.since);
    expect(halves[0]!.since).toBe(halves[1]!.until);
    expect(halves[0]!.natures).toEqual(["E2"]);
    expect(describeChunk(halves[0]!)).toContain("[E2]");
  });
  it("ne découpe plus en dessous d'une heure", () => {
    const tiny = {
      since: new Date(now.getTime() - MIN_CHUNK_MS).toISOString(),
      until: now.toISOString(),
      natures: ["E2"],
    };
    expect(splitChunk(tiny, ["E2", "FS"])).toEqual([]);
    expect(splitChunk({ since: "nope", until: "nope", natures: ["E2"] }, ["E2"])).toEqual([]);
  });
});

describe("clé de recherche live", () => {
  it("normalise ville + rayon + mots-clés", () => {
    const t = liveSearchTarget({ city: "Nantes", radius: 30, q: "Développeur Web" })!;
    expect(t.key).toBe("city:44109:30:developpeur web");
    expect(t.department).toBe("44");
    expect(t.inseeCode).toBe("44109");
    expect(parseLiveKey(t.key)?.key).toBe(t.key);
  });
  it("retombe sur le département, et refuse une recherche sans zone", () => {
    expect(liveSearchTarget({ department: "35", q: "cyber" })?.key).toBe("dep:35:cyber");
    expect(parseLiveKey("dep:35:cyber")?.departmentName).toBe("Ille-et-Vilaine");
    expect(liveSearchTarget({ q: "cyber" })).toBeNull();
    expect(liveSearchTarget({ city: "Ville-Inconnue-Xyz" })).toBeNull();
    expect(parseLiveKey("city:00000:10")).toBeNull();
  });
});

describe("fraîcheur", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
  it("classe FRESH / RECENT / STALE / UNKNOWN", () => {
    expect(computeFreshness({ publishedAt: h(10), lastVerifiedAt: h(1) }, now).level).toBe("FRESH");
    expect(
      computeFreshness(
        { publishedAt: h(30 * 24), sourceUpdatedAt: h(5), lastVerifiedAt: h(2) },
        now,
      ).level,
    ).toBe("FRESH");
    expect(computeFreshness({ publishedAt: h(5 * 24), lastVerifiedAt: h(3 * 24) }, now).level).toBe(
      "RECENT",
    );
    expect(
      computeFreshness({ publishedAt: h(5 * 24), lastVerifiedAt: h(20 * 24) }, now).level,
    ).toBe("STALE");
    expect(computeFreshness({ publishedAt: h(60 * 24), lastVerifiedAt: h(1) }, now).level).toBe(
      "STALE",
    );
    expect(computeFreshness({ publishedAt: h(1) }, now).level).toBe("UNKNOWN");
  });
  it("« Nouveau » = découverte récemment ET publiée récemment", () => {
    expect(
      computeFreshness({ publishedAt: h(20), discoveredAt: h(2), lastVerifiedAt: h(2) }, now).isNew,
    ).toBe(true);
    expect(
      computeFreshness({ publishedAt: h(30 * 24), discoveredAt: h(2), lastVerifiedAt: h(2) }, now)
        .isNew,
    ).toBe(false);
    expect(
      computeFreshness({ publishedAt: h(20), discoveredAt: h(80), lastVerifiedAt: h(2) }, now)
        .isNew,
    ).toBe(false);
  });
  it("décrit une synchronisation de façon datée, jamais « temps réel »", () => {
    expect(describeSyncedAgo(new Date(now.getTime() - 18_000), now)).toBe("il y a 18 s");
    expect(describeSyncedAgo(h(0.5), now)).toBe("il y a 30 min");
    expect(describeSyncedAgo(h(5), now)).toBe("il y a 5 h");
    expect(describeSyncedAgo(h(72), now)).toBe("il y a 3 j");
    expect(describeSyncedAgo(null, now)).toBeNull();
  });
});

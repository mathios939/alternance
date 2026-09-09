import { describe, expect, it } from "vitest";
import { buildTsQuery, synonymsOf } from "@/lib/search/synonyms";

describe("recherche — synonymes et variantes", () => {
  it("étend développeur / developpeur / developer / dev vers le même groupe", () => {
    const a = synonymsOf("développeur");
    expect(a).toEqual(expect.arrayContaining(["developpeur", "developer", "dev"]));
    expect(synonymsOf("developpeur")).toEqual(a);
    expect(synonymsOf("DEV")).toEqual(expect.arrayContaining(["developpeur"]));
  });

  it("construit une requête tsquery AND de groupes OR avec préfixes", () => {
    const q = buildTsQuery("développeur web");
    expect(q).toContain("developpeur:*");
    expect(q).toContain("developer:*");
    expect(q).toMatch(/\) & web:\*$/);
    expect(buildTsQuery("data analyst nantes")).toMatch(/nantes:\*/);
  });

  it("reconnaît les expressions multi-mots et ignore la ponctuation", () => {
    const q = buildTsQuery("full stack, react !")!;
    expect(q).toContain("fullstack:*");
    expect(q).toContain("(full & stack:*)");
    expect(q).toContain("react:*");
    expect(q).not.toMatch(/[!,]/);
  });

  it("retourne null quand rien n'est exploitable", () => {
    expect(buildTsQuery("  ")).toBeNull();
    expect(buildTsQuery("!!")).toBeNull();
  });
});

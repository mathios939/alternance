import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/external-url";

/** Les liens de candidature viennent de sources tierces : seul http(s) absolu devient un lien. */
describe("safeExternalUrl", () => {
  it("accepte http(s) absolu et normalise les espaces", () => {
    expect(safeExternalUrl("https://candidat.francetravail.fr/offres/recherche/detail/5959875")).toBe("https://candidat.francetravail.fr/offres/recherche/detail/5959875");
    expect(safeExternalUrl("  http://example.org/postuler?id=1 ")).toBe("http://example.org/postuler?id=1");
  });

  it("refuse les autres schémas, le relatif et le mal formé", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "mailto:rh@example.org", "ftp://example.org/x", "/offres/1", "example.org/x", "", "   ", null, undefined, `https://example.org/${"a".repeat(2100)}`]) {
      expect(safeExternalUrl(bad), String(bad)).toBeNull();
    }
  });
});

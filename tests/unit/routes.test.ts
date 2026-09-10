import { describe, expect, it } from "vitest";
import { AUTH_OPTIONAL_ROUTES, PROTECTED_ROUTES, PUBLIC_ROUTES, classifyPath, isProtectedPath, isPublicPath, loginUrlFor } from "@/config/routes";

/**
 * Règle produit : le cœur du site est utilisable sans compte. Ces tests verrouillent la liste
 * des routes que le proxy a le droit de protéger.
 */
describe("classification des routes", () => {
  it("le cœur public n'est jamais protégé", () => {
    for (const path of ["/", "/jobs", "/jobs/developpeur-web-nantes", "/jobs?q=développeur&city=Nantes", "/companies", "/companies/acme", "/radar", "/map", "/compare", "/sources", "/alternance/nantes", "/alternance/dev/nantes", "/tarifs", "/cgu", "/confidentialite", "/mentions-legales"]) {
      expect(isProtectedPath(path.split("?")[0]!), path).toBe(false);
      expect(classifyPath(path.split("?")[0]!), path).toBe("PUBLIC");
    }
  });

  it("le tableau de bord et les favoris sont optionnels (rendus sans compte, jamais redirigés)", () => {
    expect(classifyPath("/dashboard")).toBe("AUTH_OPTIONAL");
    expect(classifyPath("/favorites")).toBe("AUTH_OPTIONAL");
    expect(isProtectedPath("/dashboard")).toBe(false);
  });

  it("seules les fonctionnalités privées exigent une session", () => {
    for (const path of ["/applications", "/applications/abc", "/resume", "/copilot", "/notifications", "/settings", "/settings/profile", "/onboarding", "/interviews/1", "/outreach", "/analytics", "/urgence", "/admin/data"]) {
      expect(isProtectedPath(path), path).toBe(true);
      expect(classifyPath(path), path).toBe("PROTECTED");
    }
  });

  it("un préfixe ne déborde pas sur une route voisine", () => {
    // « /settings » ne doit pas capturer « /settingsx » ni « / » capturer tout le site
    expect(isProtectedPath("/settingsx")).toBe(false);
    expect(isPublicPath("/anything")).toBe(false);
    expect(classifyPath("/anything")).toBe("PUBLIC");
  });

  it("les trois listes sont disjointes", () => {
    const all = [...PUBLIC_ROUTES, ...AUTH_OPTIONAL_ROUTES, ...PROTECTED_ROUTES];
    expect(new Set(all).size).toBe(all.length);
  });

  it("l'URL de connexion conserve la destination", () => {
    expect(loginUrlFor("/applications?filter=followups")).toBe("/login?next=%2Fapplications%3Ffilter%3Dfollowups");
  });
});

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { REQUEST_PATH_HEADER, safeReturnTo } from "@/config/routes";

/**
 * Le proxy est le seul mur de connexion du site : il ne doit toucher que les routes protégées,
 * conserver la destination, et laisser passer tout le reste (avec ou sans session).
 */
const SESSION_COOKIE = "aos.session_token=abc.def";

function request(path: string, options?: { cookie?: string; headers?: Record<string, string> }): NextRequest {
  const headers = new Headers(options?.headers);
  if (options?.cookie) headers.set("cookie", options.cookie);
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

const location = (res: Response) => new URL(res.headers.get("location") ?? "http://localhost:3000/__none__").pathname + new URL(res.headers.get("location") ?? "http://localhost:3000/__none__").search;

describe("proxy", () => {
  it("renvoie une route protégée vers /login en conservant chemin et paramètres", () => {
    const res = proxy(request("/applications?filter=followups"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/login?next=%2Fapplications%3Ffilter%3Dfollowups");
  });

  it("laisse passer les routes publiques et optionnelles sans session", () => {
    for (const path of ["/", "/jobs?q=d%C3%A9veloppeur&city=Nantes", "/jobs/dev-nantes", "/companies/acme", "/radar", "/map", "/compare", "/favorites", "/dashboard", "/sources", "/alternance/nantes", "/login", "/register?next=%2Fjobs"]) {
      const res = proxy(request(path));
      expect(res.headers.get("location"), path).toBeNull();
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("laisse passer une route protégée quand un cookie de session est présent", () => {
    const res = proxy(request("/applications", { cookie: SESSION_COOKIE }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("transmet le chemin demandé aux composants serveur et écrase toute valeur venue du client", () => {
    const res = proxy(request("/settings/profile?tab=cv", { cookie: SESSION_COOKIE, headers: { [REQUEST_PATH_HEADER]: "/admin" } }));
    expect(res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)).toBe("/settings/profile?tab=cv");
  });

  it("renvoie un utilisateur déjà connecté depuis /login vers sa destination, jamais vers une URL externe", () => {
    expect(location(proxy(request("/login?next=%2Fjobs%2Fdev-nantes", { cookie: SESSION_COOKIE })))).toBe("/jobs/dev-nantes");
    expect(location(proxy(request("/login", { cookie: SESSION_COOKIE })))).toBe("/dashboard");
    expect(location(proxy(request("/register?next=%2F%2Fevil.example", { cookie: SESSION_COOKIE })))).toBe("/dashboard");
    expect(location(proxy(request("/login?next=https%3A%2F%2Fevil.example", { cookie: SESSION_COOKIE })))).toBe("/dashboard");
  });
});

describe("safeReturnTo", () => {
  it("n'accepte qu'un chemin interne, hors pages d'authentification et exclusions", () => {
    expect(safeReturnTo("/jobs/x?y=1")).toBe("/jobs/x?y=1");
    expect(safeReturnTo(["/companies/a", "/other"])).toBe("/companies/a");
    for (const bad of [undefined, null, "", "jobs", "//evil.example", "/\\evil", "/jobs\n", "https://evil.example", "/login", "/register?next=%2Fx", `/${"a".repeat(600)}`]) {
      expect(safeReturnTo(bad), String(bad)).toBe("/dashboard");
    }
    expect(safeReturnTo("/onboarding", { exclude: ["/onboarding"] })).toBe("/dashboard");
    expect(safeReturnTo("/onboarding/x", { exclude: ["/onboarding"], fallback: "/jobs" })).toBe("/jobs");
    expect(safeReturnTo(undefined, { fallback: "" })).toBe("");
  });
});

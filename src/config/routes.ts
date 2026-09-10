/**
 * Classification des routes — principe produit : UTILISER D'ABORD, CRÉER UN COMPTE ENSUITE.
 *
 * PUBLIC_ROUTES        : accessibles sans compte, jamais de redirection vers /login.
 * AUTH_OPTIONAL_ROUTES : accessibles sans compte, rendues différemment selon la session
 *                        (ex. /dashboard explique l'espace personnel, /favorites montre les favoris locaux).
 * PROTECTED_ROUTES     : fonctionnalités réellement privées (données personnelles) ; sans session → /login?next=.
 *
 * Le proxy (src/proxy.ts) n'agit que sur PROTECTED_ROUTES. Les layouts serveur ne doivent jamais
 * appeler requireUser() pour une route publique ou optionnelle.
 */
export const PUBLIC_ROUTES = ["/", "/jobs", "/companies", "/radar", "/map", "/compare", "/sources", "/alternance", "/tarifs", "/cgu", "/confidentialite", "/mentions-legales", "/login", "/register"] as const;

export const AUTH_OPTIONAL_ROUTES = ["/dashboard", "/favorites"] as const;

export const PROTECTED_ROUTES = ["/onboarding", "/applications", "/resume", "/copilot", "/interviews", "/outreach", "/analytics", "/urgence", "/notifications", "/settings", "/admin"] as const;

/** Pages d'authentification : un utilisateur déjà connecté est renvoyé vers son tableau de bord. */
export const AUTH_PAGES = ["/login", "/register"] as const;

export type RouteAccess = "PUBLIC" | "AUTH_OPTIONAL" | "PROTECTED";

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}

export function isProtectedPath(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_ROUTES);
}

export function isPublicPath(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_ROUTES);
}

export function isAuthOptionalPath(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_OPTIONAL_ROUTES);
}

/** Classe un chemin ; un chemin inconnu (ex. 404) est traité comme public : jamais de mur de connexion par défaut. */
export function classifyPath(pathname: string): RouteAccess {
  if (isProtectedPath(pathname)) return "PROTECTED";
  if (isAuthOptionalPath(pathname)) return "AUTH_OPTIONAL";
  return "PUBLIC";
}

/** Construit l'URL de connexion qui ramène l'utilisateur là où il voulait aller. */
export function loginUrlFor(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

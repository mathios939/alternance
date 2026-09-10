import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { REQUEST_PATH_HEADER, isAuthPage, isProtectedPath, loginUrlFor, safeReturnTo } from "@/config/routes";

/**
 * Vérification optimiste (présence du cookie de session) pour rediriger tôt,
 * UNIQUEMENT sur les routes protégées (src/config/routes.ts).
 * Accueil, recherche, offres, entreprises, radar, carte, comparateur, sources, pages SEO :
 * jamais de redirection vers /login. La vérification réelle de la session est faite dans les pages serveur.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "aos" });
  if (isProtectedPath(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL(loginUrlFor(`${pathname}${search}`), request.url));
  }
  if (isAuthPage(pathname) && sessionCookie) {
    // Déjà connecté : on honore la destination demandée plutôt que d'imposer le tableau de bord.
    return NextResponse.redirect(new URL(safeReturnTo(request.nextUrl.searchParams.get("next")), request.url));
  }
  // Chemin demandé transmis aux composants serveur (requireUser) pour conserver la destination
  // quand une session expirée est détectée après le proxy. Toute valeur venue du client est écrasée.
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)).*)"],
};

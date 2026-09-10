import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { AUTH_PAGES, isProtectedPath, loginUrlFor } from "@/config/routes";

/**
 * Vérification optimiste (présence du cookie de session) pour rediriger tôt,
 * UNIQUEMENT sur les routes protégées (src/config/routes.ts).
 * Accueil, recherche, offres, entreprises, radar, carte, comparateur, sources, pages SEO :
 * jamais de redirection vers /login. La vérification réelle de la session est faite dans les pages serveur.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "aos" });
  if (isProtectedPath(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL(loginUrlFor(pathname), request.url));
  }
  if ((AUTH_PAGES as readonly string[]).includes(pathname) && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)).*)"],
};

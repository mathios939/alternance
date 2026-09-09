import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieBanner } from "@/components/layout/cookie-banner";

/**
 * Pages accessibles avec ou sans compte (/jobs, /companies).
 * Connecté → coquille applicative ; sinon → coquille publique.
 */
export default async function ExploreLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();
  if (user) {
    const onboarded = user.onboardingCompletedAt ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { onboardingCompletedAt: true } }))?.onboardingCompletedAt;
    if (onboarded) return <AppShell user={{ ...user, onboardingCompletedAt: onboarded }}>{children}</AppShell>;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isAuthenticated={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}

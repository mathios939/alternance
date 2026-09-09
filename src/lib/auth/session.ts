import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Plan, UserRole } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: UserRole;
  plan: Plan;
  onboardingCompletedAt: Date | null;
};

/**
 * Récupère la session courante (mise en cache par requête).
 * Retourne null si l'utilisateur n'est pas connecté.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as typeof session.user & {
    role?: string;
    plan?: string;
    onboardingCompletedAt?: Date | string | null;
  };
  const onboarding = u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt) : null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: (u.role as UserRole | undefined) ?? "USER",
    plan: (u.plan as Plan | undefined) ?? "FREE",
    onboardingCompletedAt: onboarding,
  };
});

/** Exige un utilisateur connecté, sinon redirige vers /login. */
export async function requireUser(options?: { allowIncompleteOnboarding?: boolean }): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!options?.allowIncompleteOnboarding && !user.onboardingCompletedAt) {
    // Vérifie en base au cas où le cache cookie serait obsolète
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { onboardingCompletedAt: true } });
    if (!fresh?.onboardingCompletedAt) redirect("/onboarding");
    return { ...user, onboardingCompletedAt: fresh.onboardingCompletedAt };
  }
  return user;
}

/** Exige un administrateur. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (fresh?.role !== "ADMIN") redirect("/dashboard?forbidden=1");
    return { ...user, role: "ADMIN" };
  }
  return user;
}

/** Variante pour les Server Actions : lève une erreur au lieu de rediriger. */
export async function requireUserId(): Promise<string> {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

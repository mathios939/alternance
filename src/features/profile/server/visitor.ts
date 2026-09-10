import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/auth/session";
import { getGuestProfile } from "@/lib/guest/server";
import { guestProfileToCandidate } from "@/lib/guest/candidate";
import type { GuestProfile } from "@/lib/guest/profile";
import type { CandidateForMatching } from "@/lib/matching";
import { getCandidateContext, type CandidateContext } from "@/features/profile/server/queries";

export type VisitorContext = {
  /** Session connectée, ou null pour un visiteur. */
  session: Awaited<ReturnType<typeof getSession>>;
  userId: string | undefined;
  isAuthenticated: boolean;
  /** Profil complet du compte (null sans compte ou avant l'onboarding). */
  ctx: CandidateContext | null;
  /** Profil visiteur (cookie), uniquement quand aucun profil de compte n'existe. */
  guest: GuestProfile | null;
  /** Candidat utilisé pour les scores : profil du compte, sinon profil visiteur, sinon null. */
  candidate: CandidateForMatching | null;
  /** Vrai dès qu'un score personnalisé peut être calculé (compte ou visiteur). */
  hasProfile: boolean;
};

/**
 * Contexte de personnalisation, avec ou sans compte (mis en cache par requête).
 * Règle : le profil du compte prime ; sinon le profil visiteur ; sinon aucune personnalisation.
 */
export const getVisitorContext = cache(async (): Promise<VisitorContext> => {
  const session = await getSession();
  const ctx = session ? await getCandidateContext(session.id) : null;
  const guest = ctx ? null : await getGuestProfile();
  const candidate = ctx?.candidate ?? (guest ? guestProfileToCandidate(guest) : null);
  return { session, userId: session?.id, isAuthenticated: Boolean(session), ctx, guest, candidate, hasProfile: Boolean(candidate) };
});

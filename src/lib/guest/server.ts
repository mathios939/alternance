import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { CandidateForMatching } from "@/lib/matching";
import { guestProfileToCandidate } from "./candidate";
import { GUEST_PROFILE_COOKIE, decodeCookieValue, parseGuestProfile, type GuestProfile } from "./profile";

/** Profil visiteur lu depuis le cookie de la requête (null si absent ou vide). Mis en cache par requête. */
export const getGuestProfile = cache(async (): Promise<GuestProfile | null> => {
  const store = await cookies();
  return parseGuestProfile(decodeCookieValue(store.get(GUEST_PROFILE_COOKIE)?.value));
});

export const getGuestCandidate = cache(async (): Promise<CandidateForMatching | null> => {
  const profile = await getGuestProfile();
  return profile ? guestProfileToCandidate(profile) : null;
});

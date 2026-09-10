import { findCity } from "@/config/cities";
import { guessJobFamily } from "@/config/taxonomy";
import { skillSlugs } from "@/lib/skills";
import type { CandidateForMatching } from "@/lib/matching";
import type { ProfileValues } from "@/lib/validation/profile";
import type { GuestProfile } from "./profile";

/**
 * Projette le profil visiteur vers la vue minimale du Match Score / Opportunity Score.
 * Les critères non demandés au visiteur restent neutres (rien n'est inventé) :
 * pas d'expérience, pas de préférence de télétravail, de rythme ni de secteur.
 */
export function guestProfileToCandidate(profile: GuestProfile): CandidateForMatching {
  const city = findCity(profile.city);
  return {
    educationLevel: profile.educationLevel,
    jobFamily: guessJobFamily(profile.targetJobTitle) ?? guessJobFamily(profile.educationTitle),
    targetJobTitle: profile.targetJobTitle || null,
    skills: skillSlugs(profile.skills),
    latitude: city?.lat ?? null,
    longitude: city?.lng ?? null,
    city: city?.name ?? (profile.city || null),
    department: city?.department ?? null,
    region: city?.region ?? null,
    maxRadiusKm: profile.radiusKm,
    mobility: "DEPARTMENT",
    hasDrivingLicense: false,
    hasVehicle: false,
    remotePreference: null,
    rhythm: null,
    durationMonths: null,
    startDate: null,
    contractTypes: [],
    sectors: [],
    experienceMonths: 0,
    experienceKeywords: [],
  };
}

/** Valeurs de préremplissage de l'onboarding à partir du profil visiteur (le compte reprend ce qui a été saisi). */
export function guestProfileToProfileValues(profile: GuestProfile): Partial<ProfileValues> {
  const values: Partial<ProfileValues> = { maxRadiusKm: profile.radiusKm };
  if (profile.targetJobTitle) values.targetJobTitle = profile.targetJobTitle;
  if (profile.educationTitle) values.educationTitle = profile.educationTitle;
  if (profile.educationLevel) values.educationLevel = profile.educationLevel;
  if (profile.city) values.city = profile.city;
  if (profile.skills.length) values.skills = profile.skills;
  return values;
}

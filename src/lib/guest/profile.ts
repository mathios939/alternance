import { z } from "zod";
import { EducationLevel } from "@/generated/prisma/enums";

/**
 * PROFIL VISITEUR (mode sans compte).
 * Préférences saisies en 30 secondes pour obtenir un Match Score personnalisé, sans inscription.
 * Stockage : navigateur uniquement (cookie non sensible lisible par le serveur pour calculer
 * les scores dès le rendu, miroir localStorage). Aucune donnée sensible : ni nom, ni e-mail,
 * ni téléphone, ni CV. Effacé à la création du compte une fois repris dans le profil.
 */
export const GUEST_PROFILE_COOKIE = "aos_guest_profile";
export const GUEST_PROFILE_STORAGE_KEY = "aos.guest-profile";
/** 90 jours : assez pour une campagne de recherche, sans conserver indéfiniment. */
export const GUEST_PROFILE_MAX_AGE_SECONDS = 90 * 24 * 3600;
export const GUEST_SKILLS_MAX = 15;

export const guestProfileSchema = z.object({
  v: z.literal(1).default(1),
  targetJobTitle: z.string().trim().max(120).default(""),
  educationTitle: z.string().trim().max(120).default(""),
  educationLevel: z.enum(EducationLevel).nullable().default(null),
  city: z.string().trim().max(80).default(""),
  radiusKm: z.number().int().min(5).max(100).default(30),
  skills: z.array(z.string().trim().min(1).max(60)).max(GUEST_SKILLS_MAX).default([]),
  updatedAt: z.string().max(40).optional(),
});

export type GuestProfile = z.infer<typeof guestProfileSchema>;
export type GuestProfileInput = z.input<typeof guestProfileSchema>;

export const EMPTY_GUEST_PROFILE: GuestProfile = { v: 1, targetJobTitle: "", educationTitle: "", educationLevel: null, city: "", radiusKm: 30, skills: [] };

/** Un profil est exploitable dès qu'il apporte au moins un critère de personnalisation. */
export function isGuestProfileUsable(profile: GuestProfile | null | undefined): profile is GuestProfile {
  return Boolean(profile && (profile.city || profile.targetJobTitle || profile.educationLevel || profile.skills.length > 0));
}

/** Analyse une valeur brute (cookie ou localStorage). Retourne null si absente, invalide ou vide. */
export function parseGuestProfile(raw: string | null | undefined): GuestProfile | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = guestProfileSchema.safeParse(json);
    return parsed.success && isGuestProfileUsable(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeGuestProfile(profile: GuestProfile): string {
  return JSON.stringify({ ...profile, v: 1, skills: profile.skills.slice(0, GUEST_SKILLS_MAX), updatedAt: new Date().toISOString() });
}

/** Décodage tolérant : la valeur d'un cookie peut arriver encodée (client) ou déjà décodée (framework). */
export function decodeCookieValue(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

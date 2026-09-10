import { z } from "zod";
import { EducationLevel } from "@/generated/prisma/enums";

/**
 * PROFIL VISITEUR (mode sans compte).
 * Préférences saisies en 30 secondes pour obtenir un Match Score personnalisé, sans inscription.
 * Stockage : navigateur uniquement (cookie non sensible lisible par le serveur pour calculer
 * les scores dès le rendu, miroir localStorage). Aucune donnée sensible : ni nom, ni e-mail,
 * ni téléphone, ni CV. Effacé à la création du compte une fois repris dans le profil.
 *
 * RÈGLE : le cookie est une ENTRÉE UTILISATEUR NON FIABLE. Il est validé strictement (schéma,
 * longueurs, bornes, expiration) et ne sert qu'à personnaliser l'affichage et les scores,
 * jamais à une autorisation ni à une décision sensible.
 */
export const GUEST_PROFILE_COOKIE = "aos_guest_profile";
export const GUEST_PROFILE_STORAGE_KEY = "aos.guest-profile";
/** 90 jours : assez pour une campagne de recherche, sans conserver indéfiniment. */
export const GUEST_PROFILE_MAX_AGE_SECONDS = 90 * 24 * 3600;
export const GUEST_SKILLS_MAX = 15;
/** Taille maximale acceptée avant analyse : un profil valide pèse moins de 1,5 Ko. */
export const GUEST_PROFILE_MAX_RAW_LENGTH = 4096;

export const guestProfileSchema = z.object({
  v: z.literal(1).default(1),
  targetJobTitle: z.string().trim().max(120).default(""),
  educationTitle: z.string().trim().max(120).default(""),
  educationLevel: z.enum(EducationLevel).nullable().default(null),
  city: z.string().trim().max(80).default(""),
  radiusKm: z.number().int().min(5).max(100).default(30),
  skills: z.array(z.string().trim().min(1).max(60)).max(GUEST_SKILLS_MAX).default([]),
  /** Date d'enregistrement (ISO 8601) : sert à l'expiration, obligatoire pour être accepté. */
  updatedAt: z.string().max(40),
});

export type GuestProfile = z.infer<typeof guestProfileSchema>;
export type GuestProfileInput = z.input<typeof guestProfileSchema>;

export const EMPTY_GUEST_PROFILE: GuestProfile = { v: 1, targetJobTitle: "", educationTitle: "", educationLevel: null, city: "", radiusKm: 30, skills: [], updatedAt: "" };

/** Un profil est exploitable dès qu'il apporte au moins un critère de personnalisation. */
export function isGuestProfileUsable(profile: GuestProfile | null | undefined): profile is GuestProfile {
  return Boolean(profile && (profile.city || profile.targetJobTitle || profile.educationLevel || profile.skills.length > 0));
}

/** Expiré si la date est absente, invalide, future de plus d'un jour, ou plus vieille que 90 jours. */
export function isGuestProfileExpired(profile: Pick<GuestProfile, "updatedAt">, now: Date = new Date()): boolean {
  const saved = Date.parse(profile.updatedAt);
  if (!Number.isFinite(saved)) return true;
  const ageSeconds = (now.getTime() - saved) / 1000;
  return ageSeconds > GUEST_PROFILE_MAX_AGE_SECONDS || ageSeconds < -86_400;
}

/**
 * Analyse une valeur brute (cookie ou localStorage). Retourne null si absente, trop longue,
 * mal formée, hors schéma, vide ou expirée. Les clés inconnues sont ignorées.
 */
export function parseGuestProfile(raw: string | null | undefined, now: Date = new Date()): GuestProfile | null {
  if (!raw || raw.length > GUEST_PROFILE_MAX_RAW_LENGTH) return null;
  try {
    const json: unknown = JSON.parse(raw);
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const parsed = guestProfileSchema.safeParse(json);
    if (!parsed.success || !isGuestProfileUsable(parsed.data) || isGuestProfileExpired(parsed.data, now)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Sérialise un profil en le faisant repasser par le schéma (bornes, longueurs) et en datant l'enregistrement. */
export function serializeGuestProfile(profile: GuestProfile, now: Date = new Date()): string {
  const clean = guestProfileSchema.parse({ ...profile, v: 1, skills: profile.skills.slice(0, GUEST_SKILLS_MAX), updatedAt: now.toISOString() });
  return JSON.stringify(clean);
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

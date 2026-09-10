import { describe, expect, it } from "vitest";
import { GUEST_PROFILE_MAX_AGE_SECONDS, GUEST_PROFILE_MAX_RAW_LENGTH, GUEST_SKILLS_MAX, decodeCookieValue, isGuestProfileExpired, parseGuestProfile, serializeGuestProfile, type GuestProfile } from "@/lib/guest/profile";
import { guestProfileToCandidate, guestProfileToProfileValues } from "@/lib/guest/candidate";

/**
 * Le cookie visiteur est une entrée NON FIABLE : ces tests verrouillent ce que le serveur accepte
 * (schéma strict, bornes, expiration) et ce qu'il en déduit (jamais plus que ce qui a été saisi).
 */
const now = new Date("2026-09-10T12:00:00Z");
const valid: GuestProfile = { v: 1, targetJobTitle: "Développeur web", educationTitle: "BTS SIO", educationLevel: "BAC2", city: "Nantes", radiusKm: 30, skills: ["React", "Node.js"], updatedAt: "2026-09-01T10:00:00Z" };

describe("parseGuestProfile (cookie non fiable)", () => {
  it("accepte un profil valide et ignore les clés inconnues", () => {
    const parsed = parseGuestProfile(JSON.stringify({ ...valid, role: "ADMIN", userId: "x", plan: "PREMIUM" }), now);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed?.city).toBe("Nantes");
  });

  it("rejette l'absent, le corrompu, le non-objet et le trop long", () => {
    expect(parseGuestProfile(null, now)).toBeNull();
    expect(parseGuestProfile("", now)).toBeNull();
    expect(parseGuestProfile("{not json", now)).toBeNull();
    expect(parseGuestProfile("[]", now)).toBeNull();
    expect(parseGuestProfile('"chaîne"', now)).toBeNull();
    expect(parseGuestProfile("null", now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, city: "N".repeat(3000), skills: Array.from({ length: 15 }, () => "x".repeat(60)) }).padEnd(GUEST_PROFILE_MAX_RAW_LENGTH + 1, " "), now)).toBeNull();
  });

  it("rejette les valeurs hors bornes : rayon, niveau, longueurs, nombre de compétences, version", () => {
    expect(parseGuestProfile(JSON.stringify({ ...valid, radiusKm: 4 }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, radiusKm: 101 }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, radiusKm: 12.5 }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, radiusKm: "30" }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, educationLevel: "PHD" }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, city: "N".repeat(81) }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, targetJobTitle: "D".repeat(121) }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, skills: Array.from({ length: GUEST_SKILLS_MAX + 1 }, (_, i) => `s${i}`) }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, skills: ["ok", ""] }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, v: 2 }), now)).toBeNull();
  });

  it("rejette un profil vide (aucun critère de personnalisation)", () => {
    expect(parseGuestProfile(JSON.stringify({ v: 1, updatedAt: valid.updatedAt, radiusKm: 30 }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ v: 1, updatedAt: valid.updatedAt, city: "   " }), now)).toBeNull();
  });

  it("expire après 90 jours, ou sans date exploitable", () => {
    const old = new Date(now.getTime() - (GUEST_PROFILE_MAX_AGE_SECONDS + 60) * 1000).toISOString();
    const fresh = new Date(now.getTime() - (GUEST_PROFILE_MAX_AGE_SECONDS - 3600) * 1000).toISOString();
    expect(parseGuestProfile(JSON.stringify({ ...valid, updatedAt: old }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, updatedAt: fresh }), now)).not.toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, updatedAt: "pas une date" }), now)).toBeNull();
    expect(parseGuestProfile(JSON.stringify({ ...valid, updatedAt: undefined }), now)).toBeNull();
    // Une date dans le futur lointain ne prolonge pas la durée de vie
    expect(isGuestProfileExpired({ updatedAt: new Date(now.getTime() + 3 * 86_400_000).toISOString() }, now)).toBe(true);
  });

  it("sérialise en datant l'enregistrement et en plafonnant les compétences", () => {
    const raw = serializeGuestProfile({ ...valid, skills: Array.from({ length: 40 }, (_, i) => `s${i}`) }, now);
    const parsed = parseGuestProfile(raw, now);
    expect(parsed?.updatedAt).toBe(now.toISOString());
    expect(parsed?.skills).toHaveLength(GUEST_SKILLS_MAX);
    expect(raw.length).toBeLessThan(GUEST_PROFILE_MAX_RAW_LENGTH);
  });

  it("décode une valeur de cookie encodée ou déjà décodée", () => {
    const raw = JSON.stringify(valid);
    expect(decodeCookieValue(encodeURIComponent(raw))).toBe(raw);
    expect(decodeCookieValue(raw)).toBe(raw);
    expect(decodeCookieValue("%E0%A4%A")).toBe("%E0%A4%A");
    expect(decodeCookieValue(undefined)).toBeNull();
  });
});

describe("guestProfileToCandidate", () => {
  it("projette une ville connue en coordonnées et n'invente rien d'autre", () => {
    const c = guestProfileToCandidate(valid);
    expect(c.city).toBe("Nantes");
    expect(c.latitude).toBeCloseTo(47.2184, 3);
    expect(c.department).toBe("Loire-Atlantique");
    expect(c.jobFamily).toBe("dev");
    expect(c.skills).toEqual(expect.arrayContaining(["react", "node-js"]));
    expect(c.maxRadiusKm).toBe(30);
    expect(c.experienceMonths).toBe(0);
    expect(c.sectors).toEqual([]);
    expect(c.contractTypes).toEqual([]);
    expect(c.remotePreference).toBeNull();
  });

  it("garde une ville inconnue comme simple libellé, sans coordonnées", () => {
    const c = guestProfileToCandidate({ ...valid, city: "Trifouillis-les-Oies" });
    expect(c.city).toBe("Trifouillis-les-Oies");
    expect(c.latitude).toBeNull();
    expect(c.region).toBeNull();
  });

  it("préremplit l'onboarding uniquement avec ce qui a été saisi", () => {
    expect(guestProfileToProfileValues(valid)).toEqual({ maxRadiusKm: 30, targetJobTitle: "Développeur web", educationTitle: "BTS SIO", educationLevel: "BAC2", city: "Nantes", skills: ["React", "Node.js"] });
    expect(guestProfileToProfileValues({ ...valid, educationTitle: "", educationLevel: null, skills: [] })).toEqual({ maxRadiusKm: 30, targetJobTitle: "Développeur web", city: "Nantes" });
  });
});

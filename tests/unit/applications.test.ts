import { describe, expect, it } from "vitest";
import { canTransition, getTransitionEffects, ALLOWED_TRANSITIONS } from "@/features/applications/lib/status-machine";
import { getFollowUpRecommendations, FOLLOW_UP_AFTER_DAYS, type ApplicationForFollowUp } from "@/features/applications/lib/follow-ups";

describe("machine à états des candidatures", () => {
  it("autorise le parcours nominal", () => {
    expect(canTransition("TO_REVIEW", "TO_APPLY")).toBe(true);
    expect(canTransition("TO_APPLY", "SENT")).toBe(true);
    expect(canTransition("SENT", "TO_FOLLOW_UP")).toBe(true);
    expect(canTransition("TO_FOLLOW_UP", "INTERVIEW")).toBe(true);
    expect(canTransition("INTERVIEW", "OFFER")).toBe(true);
    expect(canTransition("OFFER", "ACCEPTED")).toBe(true);
  });

  it("interdit les raccourcis absurdes", () => {
    expect(canTransition("TO_REVIEW", "ACCEPTED")).toBe(false);
    expect(canTransition("ACCEPTED", "TO_REVIEW")).toBe(false);
    expect(canTransition("TO_APPLY", "OFFER")).toBe(false);
  });

  it("chaque statut a au moins une sortie", () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(tos.length, from).toBeGreaterThan(0);
    }
  });

  it("l'envoi fixe la date de candidature et programme une relance à 7 jours", () => {
    const effects = getTransitionEffects("TO_APPLY", "SENT", "Capgemini");
    expect(effects.setAppliedAt).toBe(true);
    expect(effects.nextActionInDays).toBe(7);
    expect(effects.activityTitle).toContain("Capgemini");
  });

  it("revenir de 'À relancer' vers 'Envoyée' compte comme une relance", () => {
    expect(getTransitionEffects("TO_FOLLOW_UP", "SENT", "X").markFollowedUp).toBe(true);
    expect(getTransitionEffects("TO_APPLY", "SENT", "X").markFollowedUp).toBe(false);
  });
});

describe("relances recommandées", () => {
  const now = new Date("2026-09-09T10:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const app = (over: Partial<ApplicationForFollowUp>): ApplicationForFollowUp => ({
    id: "a",
    status: "SENT",
    appliedAt: days(9),
    lastFollowUpAt: null,
    followUpCount: 0,
    followUpSnoozedUntil: null,
    companyName: "Capgemini",
    jobTitle: "Dev",
    ...over,
  });

  it("recommande une relance après 7 jours sans réponse", () => {
    const recos = getFollowUpRecommendations([app({})], now);
    expect(recos).toHaveLength(1);
    expect(recos[0]?.daysSinceApplied).toBe(9);
  });

  it("ne recommande rien avant 7 jours", () => {
    expect(getFollowUpRecommendations([app({ appliedAt: days(FOLLOW_UP_AFTER_DAYS - 1) })], now)).toHaveLength(0);
  });

  it("attend 7 jours après la dernière relance", () => {
    expect(getFollowUpRecommendations([app({ appliedAt: days(20), lastFollowUpAt: days(3), followUpCount: 1 })], now)).toHaveLength(0);
    expect(getFollowUpRecommendations([app({ appliedAt: days(20), lastFollowUpAt: days(8), followUpCount: 1 })], now)).toHaveLength(1);
  });

  it("respecte le report (snooze) et le maximum de 3 relances", () => {
    expect(getFollowUpRecommendations([app({ followUpSnoozedUntil: days(-2) })], now)).toHaveLength(0);
    expect(getFollowUpRecommendations([app({ followUpCount: 3, appliedAt: days(40) })], now)).toHaveLength(0);
  });

  it("ignore les candidatures qui ont déjà une réponse", () => {
    expect(getFollowUpRecommendations([app({ status: "INTERVIEW" }), app({ status: "REJECTED" })], now)).toHaveLength(0);
  });

  it("classe les plus anciennes en premier avec une urgence haute", () => {
    const recos = getFollowUpRecommendations([app({ id: "recent", appliedAt: days(8) }), app({ id: "old", appliedAt: days(16) })], now);
    expect(recos[0]?.applicationId).toBe("old");
    expect(recos[0]?.urgency).toBe("high");
  });
});

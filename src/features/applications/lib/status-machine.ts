import type { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Machine à états des candidatures.
 * Transitions volontairement souples (Kanban) mais avec des effets de bord explicites.
 */
export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  TO_REVIEW: ["TO_APPLY", "SENT", "REJECTED"],
  TO_APPLY: ["TO_REVIEW", "SENT", "REJECTED"],
  SENT: ["TO_APPLY", "TO_FOLLOW_UP", "INTERVIEW", "OFFER", "REJECTED"],
  TO_FOLLOW_UP: ["SENT", "INTERVIEW", "OFFER", "REJECTED"],
  INTERVIEW: ["SENT", "TO_FOLLOW_UP", "OFFER", "REJECTED"],
  OFFER: ["INTERVIEW", "ACCEPTED", "REJECTED"],
  REJECTED: ["TO_APPLY", "SENT", "INTERVIEW"],
  ACCEPTED: ["OFFER"],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type TransitionEffects = {
  setAppliedAt: boolean;
  clearFollowUp: boolean;
  markFollowedUp: boolean;
  nextAction: string | null;
  nextActionInDays: number | null;
  activityTitle: string;
};

/** Effets de bord d'un changement de statut (dates, prochaine action…). */
export function getTransitionEffects(from: ApplicationStatus, to: ApplicationStatus, companyName: string): TransitionEffects {
  const base: TransitionEffects = {
    setAppliedAt: false,
    clearFollowUp: false,
    markFollowedUp: false,
    nextAction: null,
    nextActionInDays: null,
    activityTitle: `Candidature ${companyName} : ${to}`,
  };
  switch (to) {
    case "TO_APPLY":
      return { ...base, nextAction: "Préparer et envoyer la candidature", nextActionInDays: 2, activityTitle: `${companyName} ajouté à « À candidater »` };
    case "SENT":
      return {
        ...base,
        setAppliedAt: true,
        markFollowedUp: from === "TO_FOLLOW_UP",
        nextAction: "Relancer si pas de réponse",
        nextActionInDays: 7,
        activityTitle: from === "TO_FOLLOW_UP" ? `${companyName} relancé` : `Candidature envoyée à ${companyName}`,
      };
    case "TO_FOLLOW_UP":
      return { ...base, nextAction: "Envoyer une relance", nextActionInDays: 0, activityTitle: `${companyName} à relancer` };
    case "INTERVIEW":
      return { ...base, clearFollowUp: true, nextAction: "Préparer l'entretien", nextActionInDays: 1, activityTitle: `Entretien obtenu chez ${companyName} 🎉` };
    case "OFFER":
      return { ...base, clearFollowUp: true, nextAction: "Analyser la proposition et répondre", nextActionInDays: 3, activityTitle: `Offre reçue de ${companyName} 🎉` };
    case "ACCEPTED":
      return { ...base, clearFollowUp: true, activityTitle: `Alternance signée chez ${companyName} 🚀` };
    case "REJECTED":
      return { ...base, clearFollowUp: true, activityTitle: `Refus de ${companyName}` };
    default:
      return { ...base, activityTitle: `${companyName} déplacé vers « À voir »` };
  }
}

export const ACTIVE_STATUSES: ApplicationStatus[] = ["TO_REVIEW", "TO_APPLY", "SENT", "TO_FOLLOW_UP", "INTERVIEW", "OFFER"];
export const SENT_STATUSES: ApplicationStatus[] = ["SENT", "TO_FOLLOW_UP", "INTERVIEW", "OFFER", "REJECTED", "ACCEPTED"];
export const RESPONSE_STATUSES: ApplicationStatus[] = ["INTERVIEW", "OFFER", "REJECTED", "ACCEPTED"];

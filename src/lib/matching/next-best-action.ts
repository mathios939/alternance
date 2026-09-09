import type { DailyActionType } from "@/generated/prisma/enums";

/**
 * ─────────────────────────────────────────────────────────────
 * NEXT BEST ACTION — l'action la plus utile maintenant.
 * L'utilisateur ne doit jamais se demander « que dois-je faire ? ».
 * ─────────────────────────────────────────────────────────────
 */
export type UserStateForActions = {
  profileCompletion: number; // 0-100
  hasResume: boolean;
  resumeScore: number | null;
  upcomingInterviews: Array<{ id: string; companyName: string; scheduledAt: Date; applicationId: string | null }>;
  followUpsDue: Array<{ applicationId: string; companyName: string; daysSinceApplied: number }>;
  highMatchJobs: Array<{ jobId: string; title: string; companyName: string; matchScore: number; city: string; slug: string }>;
  radarCompanies: Array<{ companyId: string; name: string; opportunityScore: number; slug: string; city: string }>;
  applicationsThisWeek: number;
  weeklyGoal: number;
  savedJobsNotApplied: Array<{ jobId: string; title: string; companyName: string; slug: string }>;
  urgencyMode: boolean;
  now?: Date;
};

export type NextBestAction = {
  type: DailyActionType;
  title: string;
  description: string;
  href: string;
  priority: number; // plus haut = plus urgent
  meta?: Record<string, string | number>;
  jobId?: string;
  companyId?: string;
  applicationId?: string;
};

function hoursUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / 3_600_000;
}

/** Retourne toutes les actions candidates, triées par priorité décroissante. */
export function rankActions(state: UserStateForActions): NextBestAction[] {
  const now = state.now ?? new Date();
  const actions: NextBestAction[] = [];

  // 1. Entretien imminent (< 72 h) : priorité absolue
  for (const itv of state.upcomingInterviews) {
    const h = hoursUntil(itv.scheduledAt, now);
    if (h >= 0 && h <= 72) {
      actions.push({
        type: "PREPARE_INTERVIEW",
        title: `Prépare ton entretien chez ${itv.companyName}`,
        description: h <= 24 ? "C'est dans moins de 24 h. Revois l'entreprise et tes points forts." : "Dans les 3 prochains jours : anticipe les questions probables.",
        href: `/interviews/${itv.id}`,
        priority: 100 - Math.min(h, 72) / 10,
        applicationId: itv.applicationId ?? undefined,
      });
    }
  }

  // 2. Profil incomplet : bloque la qualité des recommandations
  if (state.profileCompletion < 60) {
    actions.push({
      type: "COMPLETE_PROFILE",
      title: "Complète ton profil",
      description: `Ton profil est rempli à ${state.profileCompletion} %. Les recommandations seront bien plus précises.`,
      href: "/settings/profile",
      priority: 90,
      meta: { completion: state.profileCompletion },
    });
  }

  // 3. Pas de CV : impossible de candidater efficacement
  if (!state.hasResume) {
    actions.push({
      type: "UPDATE_RESUME",
      title: "Ajoute ton CV",
      description: "Importe ton CV pour l'analyser et l'adapter à chaque offre.",
      href: "/resume",
      priority: 85,
    });
  } else if (state.resumeScore !== null && state.resumeScore < 60) {
    actions.push({
      type: "UPDATE_RESUME",
      title: "Améliore ton CV",
      description: `Score actuel : ${state.resumeScore}/100. Quelques corrections peuvent doubler tes réponses.`,
      href: "/resume",
      priority: 55,
    });
  }

  // 4. Relances dues : le levier le moins coûteux
  for (const f of state.followUpsDue.slice(0, 5)) {
    actions.push({
      type: "FOLLOW_UP",
      title: `Relance ${f.companyName}`,
      description: `Candidature envoyée il y a ${f.daysSinceApplied} jours, sans réponse.`,
      href: `/applications?application=${f.applicationId}`,
      priority: 70 + Math.min(f.daysSinceApplied, 20) / 2,
      applicationId: f.applicationId,
    });
  }

  // 5. Offres très compatibles non traitées
  for (const j of state.highMatchJobs.slice(0, 5)) {
    actions.push({
      type: "APPLY_JOB",
      title: `Postule chez ${j.companyName}`,
      description: `${j.title} · ${j.city} · ${j.matchScore} % de compatibilité.`,
      href: `/jobs/${j.slug}`,
      priority: 40 + j.matchScore / 4 + (state.urgencyMode ? 10 : 0),
      jobId: j.jobId,
      meta: { matchScore: j.matchScore },
    });
  }

  // 6. Favoris non traités
  for (const s of state.savedJobsNotApplied.slice(0, 2)) {
    actions.push({
      type: "APPLY_JOB",
      title: `Décide pour ${s.companyName}`,
      description: `Tu as sauvegardé « ${s.title} ». Candidate ou retire-la de tes favoris.`,
      href: `/jobs/${s.slug}`,
      priority: 45,
      jobId: s.jobId,
    });
  }

  // 7. Entreprises du radar à contacter
  for (const c of state.radarCompanies.slice(0, 4)) {
    actions.push({
      type: "CONTACT_COMPANY",
      title: `Contacte ${c.name}`,
      description: `${c.city} · potentiel estimé ${c.opportunityScore} %. Candidature spontanée conseillée.`,
      href: `/companies/${c.slug}`,
      priority: 30 + c.opportunityScore / 5 + (state.urgencyMode ? 10 : 0),
      companyId: c.companyId,
      meta: { opportunityScore: c.opportunityScore },
    });
  }

  // 8. Objectif hebdo en retard
  if (state.applicationsThisWeek < state.weeklyGoal * 0.5 && state.highMatchJobs.length === 0) {
    actions.push({
      type: "SAVE_JOB",
      title: "Explore de nouvelles offres",
      description: `${state.applicationsThisWeek}/${state.weeklyGoal} candidatures cette semaine. Élargis ta recherche.`,
      href: "/jobs",
      priority: 35,
    });
  }

  return actions.sort((a, b) => b.priority - a.priority);
}

/** L'unique action la plus utile maintenant. */
export function getNextBestAction(state: UserStateForActions): NextBestAction | null {
  return rankActions(state)[0] ?? null;
}

/**
 * Construit la mission du jour : 3 à 5 actions concrètes et variées.
 * Évite de proposer 5 fois la même famille d'action.
 */
export function buildDailyMission(state: UserStateForActions, max = 5): NextBestAction[] {
  const ranked = rankActions(state);
  const mission: NextBestAction[] = [];
  const perType = new Map<DailyActionType, number>();
  const caps: Partial<Record<DailyActionType, number>> = state.urgencyMode
    ? { APPLY_JOB: 3, CONTACT_COMPANY: 2, FOLLOW_UP: 2 }
    : { APPLY_JOB: 2, CONTACT_COMPANY: 1, FOLLOW_UP: 2, PREPARE_INTERVIEW: 2, COMPLETE_PROFILE: 1, UPDATE_RESUME: 1, SAVE_JOB: 1 };
  for (const action of ranked) {
    const count = perType.get(action.type) ?? 0;
    if (count >= (caps[action.type] ?? 1)) continue;
    mission.push(action);
    perType.set(action.type, count + 1);
    if (mission.length >= max) break;
  }
  return mission;
}

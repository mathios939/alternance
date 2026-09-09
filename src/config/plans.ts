/**
 * Architecture SaaS : plans et fonctionnalités.
 * Le paiement n'est pas implémenté ; seule la logique de gating existe.
 */
export type PlanKey = "FREE" | "PREMIUM";

export type FeatureKey =
  | "search"
  | "favorites"
  | "tracker"
  | "simple_alerts"
  | "ai_documents"
  | "ai_copilot_unlimited"
  | "resume_advanced"
  | "radar_advanced"
  | "recommendations_advanced"
  | "analytics_advanced"
  | "compare";

export const PLAN_FEATURES: Record<PlanKey, ReadonlySet<FeatureKey>> = {
  FREE: new Set<FeatureKey>(["search", "favorites", "tracker", "simple_alerts", "compare", "ai_documents"]),
  PREMIUM: new Set<FeatureKey>([
    "search",
    "favorites",
    "tracker",
    "simple_alerts",
    "compare",
    "ai_documents",
    "ai_copilot_unlimited",
    "resume_advanced",
    "radar_advanced",
    "recommendations_advanced",
    "analytics_advanced",
  ]),
};

/** Quotas quotidiens (documents IA générés) par plan. */
export const PLAN_LIMITS: Record<PlanKey, { aiDocumentsPerDay: number; copilotMessagesPerDay: number; radarResults: number }> = {
  FREE: { aiDocumentsPerDay: 5, copilotMessagesPerDay: 30, radarResults: 25 },
  PREMIUM: { aiDocumentsPerDay: 100, copilotMessagesPerDay: 1000, radarResults: 200 },
};

export const PLAN_LABELS: Record<PlanKey, { name: string; price: string; pitch: string; features: string[] }> = {
  FREE: {
    name: "Gratuit",
    price: "0 €",
    pitch: "Tout ce qu'il faut pour chercher efficacement.",
    features: ["Recherche multi-sources", "Favoris & collections", "Suivi des candidatures", "Alertes simples", "5 documents IA / jour"],
  },
  PREMIUM: {
    name: "Premium",
    price: "Bientôt",
    pitch: "Pour aller plus vite, avec l'IA à fond.",
    features: ["Copilote illimité", "Analyse CV avancée", "Radar entreprises étendu", "Recommandations avancées", "Statistiques détaillées"],
  },
};

export function hasFeature(plan: PlanKey, feature: FeatureKey): boolean {
  return PLAN_FEATURES[plan].has(feature);
}

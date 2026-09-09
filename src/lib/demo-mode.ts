/**
 * MODE DÉMO (Phase 24).
 * DEMO_MODE=false → aucune offre, entreprise ni contact de démonstration n'est lue par les requêtes.
 * Les données seed restent en base pour le développement, mais deviennent invisibles.
 * Côté client, NEXT_PUBLIC_DEMO_MODE pilote uniquement l'affichage des badges.
 */
export function isDemoModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env["DEMO_MODE"] ?? env["NEXT_PUBLIC_DEMO_MODE"];
  if (value === undefined) return env["NODE_ENV"] !== "production";
  return value !== "false" && value !== "0";
}

/** Fragment `where` Prisma à fusionner dans toute requête sur job / company / contact. */
export function demoFilter(): { isDemo?: false } {
  return isDemoModeEnabled() ? {} : { isDemo: false };
}

/** Condition SQL brute équivalente (pour les requêtes plein texte). */
export function demoSqlCondition(): string {
  return isDemoModeEnabled() ? "TRUE" : '"isDemo" = false';
}

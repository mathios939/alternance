/**
 * FRAÎCHEUR D'UNE OFFRE (Phase 30) — notion interne, jamais un libellé brut dans l'interface.
 *
 * Signaux : `publishedAt` (création côté source), `sourceUpdatedAt` (dernière actualisation déclarée
 * par la source), `discoveredAt` (première fois vue par nous), `lastVerifiedAt` (dernière confirmation
 * d'existence : listage complet, vérification unitaire ou pointage lors d'une synchronisation).
 *
 *   FRESH   : actualisée par la source il y a moins de 48 h ET confirmée il y a moins de 24 h ;
 *   RECENT  : actualisée il y a moins de 14 j ET confirmée il y a moins de 7 j ;
 *   STALE   : confirmée il y a plus de 14 j, ou actualisée il y a plus de 45 j ;
 *   UNKNOWN : jamais confirmée auprès de la source.
 *
 * `isNew` (badge « Nouveau ») : découverte par nous il y a moins de 48 h ET publiée il y a moins de 7 j
 * (une vieille offre découverte lors d'un rattrapage n'est pas « nouvelle »).
 */
export type FreshnessLevel = "FRESH" | "RECENT" | "STALE" | "UNKNOWN";

export type FreshnessInput = {
  publishedAt: Date | string;
  discoveredAt?: Date | string | null;
  lastVerifiedAt?: Date | string | null;
  sourceUpdatedAt?: Date | string | null;
};

export type Freshness = {
  level: FreshnessLevel;
  isNew: boolean;
  /** Heures depuis la dernière actualisation connue (source ou publication). */
  ageHours: number;
  /** Heures depuis la dernière confirmation d'existence, null si jamais confirmée. */
  verifiedHours: number | null;
  /** Date de référence retenue pour « mise à jour » (actualisation source sinon publication). */
  updatedAt: Date;
};

export const FRESHNESS_RULES = {
  freshMaxAgeHours: 48,
  freshMaxVerifiedHours: 24,
  recentMaxAgeHours: 14 * 24,
  recentMaxVerifiedHours: 7 * 24,
  staleAfterVerifiedHours: 14 * 24,
  staleAfterAgeHours: 45 * 24,
  newMaxDiscoveredHours: 48,
  newMaxPublishedHours: 7 * 24,
} as const;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeFreshness(input: FreshnessInput, now: Date = new Date()): Freshness {
  const published = toDate(input.publishedAt) ?? now;
  const sourceUpdated = toDate(input.sourceUpdatedAt);
  const updatedAt =
    sourceUpdated && sourceUpdated.getTime() > published.getTime() ? sourceUpdated : published;
  const verified = toDate(input.lastVerifiedAt);
  const discovered = toDate(input.discoveredAt);
  const hours = (d: Date) => Math.max(0, (now.getTime() - d.getTime()) / 3_600_000);
  const ageHours = hours(updatedAt);
  const verifiedHours = verified ? hours(verified) : null;
  const r = FRESHNESS_RULES;

  let level: FreshnessLevel;
  if (verifiedHours === null) level = "UNKNOWN";
  else if (ageHours <= r.freshMaxAgeHours && verifiedHours <= r.freshMaxVerifiedHours)
    level = "FRESH";
  else if (verifiedHours > r.staleAfterVerifiedHours || ageHours > r.staleAfterAgeHours)
    level = "STALE";
  else if (ageHours <= r.recentMaxAgeHours && verifiedHours <= r.recentMaxVerifiedHours)
    level = "RECENT";
  else level = verifiedHours <= r.staleAfterVerifiedHours ? "RECENT" : "STALE";

  const isNew =
    Boolean(discovered) &&
    hours(discovered!) <= r.newMaxDiscoveredHours &&
    hours(published) <= r.newMaxPublishedHours;
  return { level, isNew, ageHours, verifiedHours, updatedAt };
}

/** Libellé véridique de dernière synchronisation : jamais « temps réel », toujours daté. */
export function describeSyncedAgo(
  lastSyncAt: Date | string | null | undefined,
  now: Date = new Date(),
): string | null {
  const d = toDate(lastSyncAt);
  if (!d) return null;
  const seconds = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

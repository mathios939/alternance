import {
  ALL_DEPARTMENT_CODES,
  departmentCodesOfRegion,
  findDepartmentByCode,
  HOT_DEPARTMENT_CODES,
  PRIORITY_DEPARTMENT_CODES,
} from "@/config/departments";

/**
 * PLANIFICATION DE LA SYNCHRONISATION NATIONALE (module pur, sans base) :
 * ordre des territoires, fenêtres, découpe des morceaux tronqués.
 */
export const SYNC_WINDOWS = { "1d": 1, "3d": 3, "7d": 7, "31d": 31, "90d": 90, "120d": 120 } as const;
export type SyncWindow = keyof typeof SYNC_WINDOWS;
export const SYNC_WINDOW_KEYS = Object.keys(SYNC_WINDOWS) as SyncWindow[];

/** Verrou d'un point de reprise considéré comme abandonné après ce délai sans battement. */
export const LOCK_TTL_MS = 10 * 60_000;
/** Absences consécutives d'un listage complet avant retrait d'une offre. */
export const MISSED_LISTINGS_BEFORE_REMOVAL = 2;
/** Plus petit morceau de fenêtre (au-delà, la source est considérée comme non paginable). */
export const MIN_CHUNK_MS = 60 * 60_000;
/** Borne haute de résultats par requête (limite de pagination France Travail). */
export const SOURCE_PAGE_CAP = 3150;

export type SyncChunk = { since: string; until: string; natures?: string[] };
export type SyncCursor = { pending: SyncChunk[]; done: number; total: number };

export type TerritoryScope = { departments?: string[]; regions?: string[]; all?: boolean };

/** Ordonne les territoires : départements prioritaires (Pays de la Loire, Bretagne), zones très demandées, puis le reste. */
export function planTerritories(scope: TerritoryScope): string[] {
  const wanted = new Set<string>();
  for (const code of scope.departments ?? []) {
    const dep = findDepartmentByCode(code);
    if (dep) wanted.add(dep.code);
  }
  for (const region of scope.regions ?? [])
    for (const code of departmentCodesOfRegion(region)) wanted.add(code);
  if (scope.all) for (const code of ALL_DEPARTMENT_CODES) wanted.add(code);
  const order = [...PRIORITY_DEPARTMENT_CODES, ...HOT_DEPARTMENT_CODES, ...ALL_DEPARTMENT_CODES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of order) {
    if (wanted.has(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

export function initialChunk(window: SyncWindow, now: Date): SyncChunk {
  return {
    since: new Date(now.getTime() - SYNC_WINDOWS[window] * 86_400_000).toISOString(),
    until: now.toISOString(),
  };
}

/**
 * Découpe un morceau tronqué : par nature de contrat d'abord (quand le morceau les combine),
 * puis par moitiés de fenêtre (le plus récent d'abord). Vide si le morceau ne peut plus être découpé.
 */
export function splitChunk(chunk: SyncChunk, natures: string[]): SyncChunk[] {
  if (!chunk.natures && natures.length > 1) return natures.map((n) => ({ ...chunk, natures: [n] }));
  const since = Date.parse(chunk.since);
  const until = Date.parse(chunk.until);
  if (!Number.isFinite(since) || !Number.isFinite(until) || until - since <= MIN_CHUNK_MS)
    return [];
  const mid = new Date(Math.floor((since + until) / 2)).toISOString();
  return [
    { ...chunk, since: mid, until: chunk.until },
    { ...chunk, since: chunk.since, until: mid },
  ];
}

export function describeChunk(chunk: SyncChunk): string {
  return `${chunk.since.slice(0, 16)} → ${chunk.until.slice(0, 16)}${chunk.natures ? ` [${chunk.natures.join(",")}]` : ""}`;
}

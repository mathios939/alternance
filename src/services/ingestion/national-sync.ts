import { Prisma } from "@/generated/prisma/client";
import type { SyncCheckpointStatus } from "@/generated/prisma/enums";
import { findDepartmentByCode } from "@/config/departments";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { QuotaPriority } from "@/services/job-sources/quota";
import type { IngestReport, JobSourceProvider } from "@/services/job-sources/types";
import { runIngestion } from "./pipeline";
import {
  initialChunk,
  LOCK_TTL_MS,
  MISSED_LISTINGS_BEFORE_REMOVAL,
  SOURCE_PAGE_CAP,
  splitChunk,
  describeChunk,
  SYNC_WINDOWS,
  type SyncChunk,
  type SyncCursor,
  type SyncWindow,
} from "./national-plan";

/**
 * ─────────────────────────────────────────────────────────────
 * SYNCHRONISATION NATIONALE (Phase 30) — reprenable, idempotente, découpée, observable.
 *
 * Unité de travail : un TERRITOIRE (département) × une FENÊTRE de publication (1 j, 7 j, 31 j).
 * Chaque unité a son point de reprise (`sync_checkpoint`) :
 *   • verrou par worker (lockedBy / lockedAt, expiré après LOCK_TTL) : jamais deux exécutions
 *     simultanées sur la même unité, un run interrompu est repris par le suivant ;
 *   • curseur = liste des morceaux restants (fenêtre temporelle × nature de contrat). Un morceau
 *     tronqué par la borne de pagination de la source (3 150 résultats) est découpé : d'abord par
 *     nature de contrat (apprentissage / professionnalisation), puis par moitiés de fenêtre,
 *     jusqu'à une heure. La couverture est donc maximale sans jamais dépasser la borne ;
 *   • si le run s'arrête au département 56 (budget de temps, erreur, crash), le curseur restant
 *     est conservé dans `nextCursor` : le run suivant reprend là, pas depuis zéro.
 *
 * Réconciliation : après un listage COMPLET d'un territoire (aucun morceau tronqué ni en erreur),
 * une offre publiée dans la fenêtre mais absente du listage est comptée « manquée ». Manquée
 * deux fois de suite → retirée (REMOVED) ; manquée une fois → « non vérifiée » (UNKNOWN), vérifiée
 * en priorité par `jobs:verify`. Les offres retirées restent en base pour l'historique des
 * candidatures et favoris ; elles disparaissent simplement des recherches.
 * ─────────────────────────────────────────────────────────────
 */
const log = createLogger("ingestion:national");

export {
  SYNC_WINDOWS,
  SYNC_WINDOW_KEYS,
  LOCK_TTL_MS,
  MISSED_LISTINGS_BEFORE_REMOVAL,
  MIN_CHUNK_MS,
  SOURCE_PAGE_CAP,
  planTerritories,
  initialChunk,
  splitChunk,
  describeChunk,
} from "./national-plan";
export type { SyncWindow, SyncChunk, SyncCursor, TerritoryScope } from "./national-plan";

export type TerritorySyncStatus =
  "success" | "partial" | "error" | "interrupted" | "locked" | "fresh";

export type TerritorySyncResult = {
  territory: string;
  window: SyncWindow;
  status: TerritorySyncStatus;
  chunks: number;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  rejected: number;
  failed: number;
  removed: number;
  missed: number;
  requests: number;
  truncated: boolean;
  durationMs: number;
  errors: string[];
  warnings: string[];
};

export type TerritorySyncOptions = {
  provider: JobSourceProvider;
  territory: string;
  window: SyncWindow;
  trigger?: string;
  workerId?: string;
  priority?: QuotaPriority;
  /** Horodatage (ms) au-delà duquel le territoire est interrompu proprement (curseur conservé). */
  deadline?: number;
  /** Ignore le territoire si son dernier succès date de moins de `maxAgeHours` heures. */
  maxAgeHours?: number;
  now?: () => Date;
  onChunk?: (info: { chunk: SyncChunk; report: IngestReport; remaining: number }) => void;
};

function counters(result: TerritorySyncResult) {
  return {
    fetchedCount: result.fetched,
    createdCount: result.created,
    updatedCount: result.updated,
    duplicateCount: result.duplicates,
    rejectedCount: result.rejected,
    failedCount: result.failed,
    removedCount: result.removed,
    requestCount: result.requests,
    truncated: result.truncated,
    durationMs: result.durationMs,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Réserve (ou reprend) le point de reprise d'un territoire. `null` si un autre worker le tient. */
async function claimCheckpoint(input: {
  provider: string;
  territory: string;
  window: SyncWindow;
  workerId: string;
  now: Date;
}) {
  const key = {
    provider: input.provider,
    kind: "TERRITORY" as const,
    territory: input.territory,
    window: input.window,
  };
  const existing = await prisma.syncCheckpoint.upsert({
    where: { provider_kind_territory_window: key },
    create: { ...key, status: "PENDING" },
    update: {},
  });
  const stale = new Date(input.now.getTime() - LOCK_TTL_MS);
  const claimed = await prisma.syncCheckpoint.updateMany({
    where: {
      id: existing.id,
      OR: [
        { status: { not: "RUNNING" } },
        { lockedAt: null },
        { lockedAt: { lt: stale } },
        { lockedBy: input.workerId },
      ],
    },
    data: {
      status: "RUNNING",
      lockedBy: input.workerId,
      lockedAt: input.now,
      lastStartedAt: input.now,
      lastError: null,
      runCount: { increment: 1 },
    },
  });
  if (claimed.count === 0) return null;
  const resumable =
    existing.status === "RUNNING" || existing.status === "PARTIAL" || existing.status === "ERROR";
  const cursor =
    resumable && existing.nextCursor && typeof existing.nextCursor === "object"
      ? (existing.nextCursor as unknown as SyncCursor)
      : null;
  return {
    id: existing.id,
    previousStatus: existing.status,
    lastSuccessAt: existing.lastSuccessAt,
    resume: cursor && Array.isArray(cursor.pending) && cursor.pending.length > 0 ? cursor : null,
  };
}

/**
 * Réconcilie un listage complet : offres de la source publiées dans la fenêtre, dans ce département,
 * non revues pendant ce passage → manquées (UNKNOWN), retirées après deux absences consécutives.
 */
export async function reconcileListing(input: {
  sourceId: string;
  departmentName: string;
  since: Date;
  until: Date;
  runStartedAt: Date;
  now: Date;
}): Promise<{
  missed: number;
  removedEntries: number;
  removedJobs: number;
  markedUnknown: number;
}> {
  const scope = {
    sourceId: input.sourceId,
    job: { department: input.departmentName, isDemo: false },
  };
  const missed = await prisma.jobSourceEntry.updateMany({
    where: {
      ...scope,
      status: { in: ["ACTIVE", "UNKNOWN"] },
      lastSeenAt: { lt: input.runStartedAt },
      publishedAt: { gte: input.since, lte: input.until },
    },
    data: { missedListings: { increment: 1 }, status: "UNKNOWN" },
  });
  const removedEntries = await prisma.jobSourceEntry.updateMany({
    where: { ...scope, status: "UNKNOWN", missedListings: { gte: MISSED_LISTINGS_BEFORE_REMOVAL } },
    data: { status: "REMOVED", lastVerifiedAt: input.now },
  });
  const removedJobs = await prisma.job.updateMany({
    where: {
      isDemo: false,
      isActive: true,
      department: input.departmentName,
      sourceEntries: { none: { status: { in: ["ACTIVE", "UNKNOWN"] } } },
    },
    data: { verificationStatus: "REMOVED", isActive: false, lastVerifiedAt: input.now },
  });
  const markedUnknown = await prisma.job.updateMany({
    where: {
      isDemo: false,
      isActive: true,
      department: input.departmentName,
      verificationStatus: "ACTIVE",
      sourceEntries: { none: { status: "ACTIVE" }, some: { status: "UNKNOWN" } },
    },
    data: { verificationStatus: "UNKNOWN" },
  });
  return {
    missed: missed.count,
    removedEntries: removedEntries.count,
    removedJobs: removedJobs.count,
    markedUnknown: markedUnknown.count,
  };
}

/** Synchronise un territoire pour une fenêtre, avec reprise et découpe automatiques. */
export async function syncTerritory(options: TerritorySyncOptions): Promise<TerritorySyncResult> {
  const { provider, territory, window } = options;
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const priority = options.priority ?? (window === "1d" ? "recent" : "backfill");
  const result: TerritorySyncResult = {
    territory,
    window,
    status: "success",
    chunks: 0,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    removed: 0,
    missed: 0,
    requests: 0,
    truncated: false,
    durationMs: 0,
    errors: [],
    warnings: [],
  };
  const dep = findDepartmentByCode(territory);
  if (!dep) {
    result.status = "error";
    result.errors.push(`Département inconnu : ${territory}`);
    return result;
  }

  const claim = await claimCheckpoint({
    provider: provider.key,
    territory: dep.code,
    window,
    workerId,
    now: startedAt,
  });
  if (!claim) {
    result.status = "locked";
    result.warnings.push("Territoire en cours de synchronisation par un autre worker.");
    return result;
  }
  if (
    !claim.resume &&
    options.maxAgeHours !== undefined &&
    claim.lastSuccessAt &&
    startedAt.getTime() - claim.lastSuccessAt.getTime() < options.maxAgeHours * 3_600_000
  ) {
    await prisma.syncCheckpoint.update({
      where: { id: claim.id },
      data: {
        status: claim.previousStatus === "RUNNING" ? "SUCCESS" : claim.previousStatus,
        lockedBy: null,
        lockedAt: null,
        runCount: { decrement: 1 },
      },
    });
    result.status = "fresh";
    return result;
  }

  const natures = provider.contractNatures ? await provider.contractNatures() : [];
  const cursor: SyncCursor = claim.resume ?? {
    pending: [initialChunk(window, startedAt)],
    done: 0,
    total: 1,
  };
  const windowStart = new Date(startedAt.getTime() - SYNC_WINDOWS[window] * 86_400_000);
  if (claim.resume)
    log.info("Reprise d'un territoire interrompu", {
      provider: provider.key,
      territory: dep.code,
      window,
      remaining: cursor.pending.length,
      done: cursor.done,
    });
  const source = await prisma.jobSource.findUnique({
    where: { key: provider.key },
    select: { id: true },
  });
  let complete = true;
  let interrupted = false;

  const persist = async (
    status: SyncCheckpointStatus,
    extra: Prisma.SyncCheckpointUpdateInput = {},
  ) => {
    result.durationMs = now().getTime() - startedAt.getTime();
    await prisma.syncCheckpoint.update({
      where: { id: claim.id },
      data: { status, lockedAt: now(), cursor: toJson(cursor), ...counters(result), ...extra },
    });
  };

  try {
    while (cursor.pending.length > 0) {
      if (options.deadline !== undefined && now().getTime() >= options.deadline) {
        interrupted = true;
        break;
      }
      const chunk = cursor.pending.shift()!;
      const splittable = splitChunk(chunk, natures).length > 0;
      const report = await runIngestion({
        provider,
        trigger: options.trigger ?? "national",
        now,
        // Un morceau encore découpable s'arrête à la première page s'il est tronqué (une requête, pas vingt et une).
        params: {
          department: dep.code,
          since: new Date(chunk.since),
          until: new Date(chunk.until),
          contractNatures: chunk.natures,
          limit: SOURCE_PAGE_CAP,
          priority,
          stopIfTruncated: splittable,
        },
      });
      result.chunks++;
      result.fetched += report.fetched;
      result.created += report.created;
      result.updated += report.updated;
      result.unchanged += report.unchanged;
      result.duplicates += report.duplicates;
      result.rejected += report.rejected;
      result.failed += report.failed;
      result.requests += report.requests;
      result.warnings.push(
        ...report.warnings.filter(
          (w) => !w.startsWith("Résultats tronqués") && !w.startsWith("Fenêtre trop large"),
        ),
      );
      if (report.errors.length > 0) result.errors.push(...report.errors.slice(0, 3));
      if (report.fetched === 0 && report.errors.length > 0) {
        // Erreur de source (authentification, réseau après retries…) : le morceau est conservé pour reprise.
        cursor.pending.unshift(chunk);
        complete = false;
        await persist("ERROR", {
          nextCursor: toJson(cursor),
          lastError: report.errors[0]?.slice(0, 500) ?? null,
          lockedBy: null,
        });
        result.status = "error";
        return result;
      }
      if (report.truncated) {
        const parts = splitChunk(chunk, natures);
        if (parts.length > 0) {
          cursor.pending.unshift(...parts);
          cursor.total += parts.length;
          log.info("Morceau tronqué découpé", {
            territory: dep.code,
            window,
            chunk: describeChunk(chunk),
            parts: parts.length,
            total: report.total,
          });
        } else {
          result.truncated = true;
          complete = false;
          result.warnings.push(
            `Morceau non découpable encore tronqué : ${describeChunk(chunk)} (${report.total} annoncées).`,
          );
        }
      }
      cursor.done++;
      options.onChunk?.({ chunk, report, remaining: cursor.pending.length });
      await persist("RUNNING", {
        nextCursor: toJson(cursor),
        totalAnnounced: report.total ?? undefined,
      });
    }

    if (interrupted) {
      await persist("PARTIAL", {
        nextCursor: toJson(cursor),
        lockedBy: null,
        lastError: "Interrompu par le budget de temps ; reprise au prochain run.",
      });
      result.status = "interrupted";
      result.warnings.push(
        `Interrompu : ${cursor.pending.length} morceau(x) restant(s), repris au prochain run.`,
      );
      return result;
    }

    // Réconciliation : uniquement après un listage complet, sinon on pourrait retirer des offres encore actives.
    if (complete && result.failed === 0 && source) {
      const rec = await reconcileListing({
        sourceId: source.id,
        departmentName: dep.name,
        since: windowStart,
        until: startedAt,
        runStartedAt: startedAt,
        now: now(),
      });
      result.missed = rec.missed;
      result.removed = rec.removedJobs;
      if (rec.missed || rec.removedJobs)
        log.info("Réconciliation du listage", { territory: dep.code, window, ...rec });
    }
    const status: SyncCheckpointStatus = complete && result.failed === 0 ? "SUCCESS" : "PARTIAL";
    result.status = status === "SUCCESS" ? "success" : "partial";
    await persist(status, {
      nextCursor: Prisma.JsonNull,
      cursor: Prisma.JsonNull,
      lockedBy: null,
      lastSuccessAt: status === "SUCCESS" ? now() : undefined,
      lastError: status === "SUCCESS" ? null : (result.warnings[0] ?? null),
    });
    log.info("Territoire synchronisé", {
      provider: provider.key,
      territory: dep.code,
      window,
      status: result.status,
      chunks: result.chunks,
      fetched: result.fetched,
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      removed: result.removed,
      requests: result.requests,
      durationMs: result.durationMs,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    result.status = "error";
    await persist("ERROR", {
      nextCursor: toJson(cursor),
      lockedBy: null,
      lastError: message.slice(0, 500),
    }).catch(() => undefined);
    log.error("Territoire en erreur", error, {
      provider: provider.key,
      territory: dep.code,
      window,
    });
    return result;
  }
}

export type NationalSyncOptions = {
  provider: JobSourceProvider;
  territories: string[];
  window: SyncWindow;
  trigger?: string;
  workerId?: string;
  priority?: QuotaPriority;
  /** Budget de temps total (minutes) ; le territoire en cours est interrompu proprement. */
  maxMinutes?: number;
  /** Territoires dont le dernier succès a moins de `maxAgeHours` heures : ignorés. */
  maxAgeHours?: number;
  /** Nombre maximal de territoires réellement synchronisés (les « frais » ne comptent pas). */
  maxTerritories?: number;
  now?: () => Date;
  onTerritory?: (result: TerritorySyncResult) => void;
  onChunk?: TerritorySyncOptions["onChunk"];
  /** Appelé avant chaque territoire : permet d'intercaler un passage « nouveautés » pendant un long rattrapage. */
  beforeTerritory?: () => Promise<void>;
};

export type NationalSyncReport = {
  window: SyncWindow;
  planned: number;
  synced: number;
  fresh: number;
  locked: number;
  interrupted: number;
  errors: number;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  removed: number;
  requests: number;
  durationMs: number;
  deadlineReached: boolean;
  results: TerritorySyncResult[];
};

/** Enchaîne les territoires dans l'ordre du plan, sous budget de temps ; chaque territoire est reprenable. */
export async function runNationalSync(options: NationalSyncOptions): Promise<NationalSyncReport> {
  const now = options.now ?? (() => new Date());
  const started = now().getTime();
  const deadline =
    options.maxMinutes !== undefined ? started + options.maxMinutes * 60_000 : undefined;
  const report: NationalSyncReport = {
    window: options.window,
    planned: options.territories.length,
    synced: 0,
    fresh: 0,
    locked: 0,
    interrupted: 0,
    errors: 0,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    removed: 0,
    requests: 0,
    durationMs: 0,
    deadlineReached: false,
    results: [],
  };
  for (const territory of options.territories) {
    if (deadline !== undefined && now().getTime() >= deadline) {
      report.deadlineReached = true;
      break;
    }
    if (options.maxTerritories !== undefined && report.synced >= options.maxTerritories) break;
    if (options.beforeTerritory) await options.beforeTerritory();
    const result = await syncTerritory({
      provider: options.provider,
      territory,
      window: options.window,
      trigger: options.trigger,
      workerId: options.workerId,
      priority: options.priority,
      deadline,
      maxAgeHours: options.maxAgeHours,
      now,
      onChunk: options.onChunk,
    });
    report.results.push(result);
    options.onTerritory?.(result);
    if (result.status === "fresh") report.fresh++;
    else if (result.status === "locked") report.locked++;
    else {
      report.synced++;
      report.fetched += result.fetched;
      report.created += result.created;
      report.updated += result.updated;
      report.unchanged += result.unchanged;
      report.duplicates += result.duplicates;
      report.removed += result.removed;
      report.requests += result.requests;
      if (result.status === "interrupted") report.interrupted++;
      if (result.status === "error") report.errors++;
    }
    if (result.status === "interrupted") {
      report.deadlineReached = true;
      break;
    }
  }
  report.durationMs = now().getTime() - started;
  return report;
}

/** Territoires dont la fenêtre n'a jamais été synchronisée ou l'a été il y a le plus longtemps (rattrapage progressif). */
export async function staleTerritories(
  provider: string,
  window: SyncWindow,
  candidates: string[],
  limit: number,
): Promise<string[]> {
  const rows = await prisma.syncCheckpoint.findMany({
    where: { provider, kind: "TERRITORY", window, territory: { in: candidates } },
    select: { territory: true, lastSuccessAt: true, status: true },
  });
  const byTerritory = new Map(rows.map((r) => [r.territory, r]));
  const order = [...candidates].sort((a, b) => {
    const ra = byTerritory.get(a);
    const rb = byTerritory.get(b);
    // Reprises (PARTIAL / ERROR) d'abord, puis jamais synchronisés, puis les plus anciens.
    const pa =
      ra && (ra.status === "PARTIAL" || ra.status === "ERROR") ? 0 : ra?.lastSuccessAt ? 2 : 1;
    const pb =
      rb && (rb.status === "PARTIAL" || rb.status === "ERROR") ? 0 : rb?.lastSuccessAt ? 2 : 1;
    if (pa !== pb) return pa - pb;
    return (
      (ra?.lastSuccessAt?.getTime() ?? 0) - (rb?.lastSuccessAt?.getTime() ?? 0) ||
      candidates.indexOf(a) - candidates.indexOf(b)
    );
  });
  return order.slice(0, limit);
}

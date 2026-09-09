import { Prisma } from "@/generated/prisma/client";
import type { IngestionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export type RunCounters = {
  fetchedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
  failedCount?: number;
  expiredCount?: number;
};

export async function startRun(input: { sourceKey: string; sourceId?: string | null; trigger: string; params?: unknown; status?: IngestionStatus; errorSummary?: string }) {
  return prisma.ingestionRun.create({
    data: {
      sourceKey: input.sourceKey,
      sourceId: input.sourceId ?? null,
      trigger: input.trigger,
      params: input.params === undefined ? Prisma.JsonNull : (input.params as Prisma.InputJsonValue),
      status: input.status ?? "RUNNING",
      errorSummary: input.errorSummary ?? null,
      finishedAt: input.status && input.status !== "RUNNING" ? new Date() : null,
    },
  });
}

export async function finishRun(id: string, input: { status: IngestionStatus; counters: RunCounters; errors?: string[]; startedAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  const errors = input.errors ?? [];
  return prisma.ingestionRun.update({
    where: { id },
    data: {
      status: input.status,
      finishedAt: now,
      durationMs: Math.max(0, now.getTime() - input.startedAt.getTime()),
      ...input.counters,
      errorSummary: errors.length ? `${errors.length} erreur(s) : ${errors[0]?.slice(0, 300)}` : null,
      errors: errors.length ? (errors.slice(0, 50) as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

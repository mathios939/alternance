-- CreateEnum
CREATE TYPE "SyncCheckpointKind" AS ENUM ('TERRITORY', 'LIVE_SEARCH');

-- CreateEnum
CREATE TYPE "SyncCheckpointStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR');

-- AlterTable
ALTER TABLE "job" ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_source_entry" ADD COLUMN     "missedListings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sync_checkpoint" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" "SyncCheckpointKind" NOT NULL DEFAULT 'TERRITORY',
    "territory" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "status" "SyncCheckpointStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "cursor" JSONB,
    "nextCursor" JSONB,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "totalAnnounced" INTEGER,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_quota" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "provider_quota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_checkpoint_provider_kind_status_idx" ON "sync_checkpoint"("provider", "kind", "status");

-- CreateIndex
CREATE INDEX "sync_checkpoint_provider_kind_lastSuccessAt_idx" ON "sync_checkpoint"("provider", "kind", "lastSuccessAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_checkpoint_provider_kind_territory_window_key" ON "sync_checkpoint"("provider", "kind", "territory", "window");

-- CreateIndex
CREATE UNIQUE INDEX "provider_quota_provider_bucket_key" ON "provider_quota"("provider", "bucket");

-- CreateIndex
CREATE INDEX "job_discoveredAt_idx" ON "job"("discoveredAt");

-- CreateIndex
CREATE INDEX "job_source_entry_sourceId_lastVerifiedAt_idx" ON "job_source_entry"("sourceId", "lastVerifiedAt");

-- Index partiels pour la recherche publique (offres visibles : actives, canoniques, réelles, non expirées).
-- Non déclarables dans le schéma Prisma : si une migration générée propose de les supprimer, conserver ces index.
CREATE INDEX "job_visible_published_idx" ON "job" ("publishedAt" DESC)
  WHERE "isActive" = true AND "canonicalJobId" IS NULL AND "isDemo" = false AND "verificationStatus" NOT IN ('EXPIRED', 'REMOVED');
CREATE INDEX "job_visible_geo_idx" ON "job" ("latitude", "longitude")
  WHERE "isActive" = true AND "canonicalJobId" IS NULL AND "isDemo" = false AND "verificationStatus" NOT IN ('EXPIRED', 'REMOVED');
CREATE INDEX "job_visible_department_idx" ON "job" ("department", "publishedAt" DESC)
  WHERE "isActive" = true AND "canonicalJobId" IS NULL AND "isDemo" = false AND "verificationStatus" NOT IN ('EXPIRED', 'REMOVED');

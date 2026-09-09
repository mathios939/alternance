-- CreateEnum
CREATE TYPE "JobVerificationStatus" AS ENUM ('ACTIVE', 'UNKNOWN', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOUR', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR', 'SKIPPED');

-- AlterEnum
ALTER TYPE "ContactSource" ADD VALUE 'JOB_POSTING';

-- AlterEnum
ALTER TYPE "DataOrigin" ADD VALUE 'UNKNOWN';

-- AlterEnum
ALTER TYPE "JobSourceType" ADD VALUE 'ATS';

-- DropIndex
DROP INDEX "company_name_trgm_idx";

-- DropIndex
DROP INDEX "job_title_trgm_idx";

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "dataSources" JSONB,
ADD COLUMN     "employeeRange" TEXT,
ADD COLUMN     "employeeRangeLabel" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "legalCategory" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "nafCode" TEXT,
ADD COLUMN     "nafLabel" TEXT,
ADD COLUMN     "nameNormalized" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "siren" TEXT,
ADD COLUMN     "siret" TEXT;

-- AlterTable
ALTER TABLE "contact" ADD COLUMN     "contactUrl" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "professionalContext" TEXT,
ADD COLUMN     "publiclyAvailable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "firstName" SET DEFAULT '',
ALTER COLUMN "lastName" SET DEFAULT '';

-- AlterTable
ALTER TABLE "job" ADD COLUMN     "applicationEmail" TEXT,
ADD COLUMN     "applicationLabel" TEXT,
ADD COLUMN     "companyNameRaw" TEXT,
ADD COLUMN     "dataQualityScore" INTEGER,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "nafCode" TEXT,
ADD COLUMN     "normalizedTitle" TEXT,
ADD COLUMN     "positionsCount" INTEGER,
ADD COLUMN     "romeCode" TEXT,
ADD COLUMN     "salaryPeriod" "SalaryPeriod",
ADD COLUMN     "verificationStatus" "JobVerificationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "job_source" ADD COLUMN     "capabilities" JSONB,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "job_source_entry" ADD COLUMN     "applicationEmail" TEXT,
ADD COLUMN     "applicationLabel" TEXT,
ADD COLUMN     "applicationUrl" TEXT,
ADD COLUMN     "duplicateConfidence" DOUBLE PRECISION,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "JobVerificationStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ingestion_run" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceId" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "params" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RUNNING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "expiredCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "errors" JSONB,

    CONSTRAINT "ingestion_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_run_sourceKey_startedAt_idx" ON "ingestion_run"("sourceKey", "startedAt");

-- CreateIndex
CREATE INDEX "company_siren_idx" ON "company"("siren");

-- CreateIndex
CREATE INDEX "company_nameNormalized_idx" ON "company"("nameNormalized");

-- CreateIndex
CREATE INDEX "company_isDemo_idx" ON "company"("isDemo");

-- CreateIndex
CREATE INDEX "contact_jobId_idx" ON "contact"("jobId");

-- CreateIndex
CREATE INDEX "job_verificationStatus_idx" ON "job"("verificationStatus");

-- CreateIndex
CREATE INDEX "job_lastVerifiedAt_idx" ON "job"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "job_isDemo_idx" ON "job"("isDemo");

-- CreateIndex
CREATE INDEX "job_source_entry_status_lastSeenAt_idx" ON "job_source_entry"("status", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_run" ADD CONSTRAINT "ingestion_run_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "job_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Recherche plein texte insensible aux accents (Phase 17)
-- « développeur », « developpeur » et « DÉVELOPPEUR » indexent le même lexème.
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'french_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION french_unaccent ( COPY = french );
    ALTER TEXT SEARCH CONFIGURATION french_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;
  END IF;
END
$$;

DROP INDEX IF EXISTS "job_fulltext_idx";
CREATE INDEX "job_fulltext_idx" ON "job" USING GIN (
  to_tsvector('french_unaccent'::regconfig, coalesce("title", '') || ' ' || coalesce("description", ''))
);
DROP INDEX IF EXISTS "company_fulltext_idx";
CREATE INDEX "company_fulltext_idx" ON "company" USING GIN (
  to_tsvector('french_unaccent'::regconfig, coalesce("name", '') || ' ' || coalesce("description", ''))
);

-- Rapprochement par similarité sur les libellés normalisés
CREATE INDEX "job_normalized_title_trgm_idx" ON "job" USING GIN ("normalizedTitle" gin_trgm_ops);
CREATE INDEX "company_name_normalized_trgm_idx" ON "company" USING GIN ("nameNormalized" gin_trgm_ops);

-- Remplissage initial des colonnes normalisées pour les lignes existantes
UPDATE "job" SET "normalizedTitle" = lower(unaccent("title")) WHERE "normalizedTitle" IS NULL;
UPDATE "company" SET "nameNormalized" = lower(unaccent("name")) WHERE "nameNormalized" IS NULL;
-- Les offres existantes (seed) restent « non vérifiées » tant qu'une source ne les confirme pas.

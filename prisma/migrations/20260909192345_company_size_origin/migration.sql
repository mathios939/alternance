-- DropIndex
DROP INDEX "company_name_normalized_trgm_idx";

-- DropIndex
DROP INDEX "job_normalized_title_trgm_idx";

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sizeOrigin" "DataOrigin" NOT NULL DEFAULT 'DEMO';

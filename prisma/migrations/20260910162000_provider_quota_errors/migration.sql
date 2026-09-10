-- Observabilité du quota : 429 et erreurs par fournisseur et par minute (colonnes additives).
ALTER TABLE "provider_quota" ADD COLUMN "rateLimited" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errors" INTEGER NOT NULL DEFAULT 0;

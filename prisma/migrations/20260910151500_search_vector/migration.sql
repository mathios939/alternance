-- Recherche plein texte à l'échelle nationale : vecteur STOCKÉ (colonne générée) au lieu d'être
-- recalculé à chaque classement. Mesuré sur 40 000 offres (npm run db:perf) : la requête
-- « développeur » passait de 1 422 ms (vecteur recalculé pour chaque ligne classée) à quelques ms.
-- Les compétences de l'annonce entrent dans le vecteur : plus de sous-requête ILIKE sur le tableau.
CREATE OR REPLACE FUNCTION job_search_document(title text, description text, skills text[]) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT to_tsvector('french_unaccent'::regconfig, coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(skills, ' '), ''))
$$;

ALTER TABLE "job" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (job_search_document("title", "description", "skillsText")) STORED;

CREATE INDEX "job_search_vector_idx" ON "job" USING GIN ("searchVector");

-- L'index d'expression précédent est remplacé par l'index sur la colonne stockée.
DROP INDEX IF EXISTS "job_fulltext_idx";

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeText } from "@/lib/text/normalize";
import type { FullTextSearchProvider, SearchHit } from "./types";

function orQuery(query: string): string {
  return normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => `${t.replace(/[^a-z0-9]/g, "")}:*`)
    .filter((t) => t.length > 2)
    .join(" | ");
}

/**
 * Recherche PostgreSQL : d'abord une requête stricte (tous les mots),
 * puis élargie (au moins un mot, préfixes) si rien n'est trouvé.
 * Le titre et les compétences sont aussi testés en ILIKE pour la tolérance.
 */
export class PostgresSearchProvider implements FullTextSearchProvider {
  readonly name = "postgres";

  async searchJobs(query: string, options?: { limit?: number }): Promise<SearchHit[]> {
    const limit = options?.limit ?? 400;
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    const strict = await prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id,
        ts_rank(to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '')), plainto_tsquery('french', ${q}))
          + (CASE WHEN title ILIKE ${like} THEN 0.5 ELSE 0 END)::float AS rank
      FROM job
      WHERE "isActive" = true
        AND (
          to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('french', ${q})
          OR title ILIKE ${like}
          OR EXISTS (SELECT 1 FROM unnest("skillsText") s WHERE s ILIKE ${like})
        )
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    if (strict.length > 0) return strict;
    const loose = orQuery(q);
    if (!loose) return [];
    return prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id,
        ts_rank(to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '')), to_tsquery('french', ${loose}))::float AS rank
      FROM job
      WHERE "isActive" = true
        AND to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '')) @@ to_tsquery('french', ${loose})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
  }

  async searchCompanies(query: string, options?: { limit?: number }): Promise<SearchHit[]> {
    const limit = options?.limit ?? 200;
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    return prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id,
        (ts_rank(to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, '')), plainto_tsquery('french', ${q}))
          + (CASE WHEN name ILIKE ${like} THEN 1 ELSE 0 END)
          + similarity(name, ${q}))::float AS rank
      FROM company
      WHERE to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('french', ${q})
        OR name ILIKE ${like}
        OR similarity(name, ${q}) > 0.3
        OR EXISTS (SELECT 1 FROM unnest(technologies) t WHERE t ILIKE ${like})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
  }
}

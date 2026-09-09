import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { buildTsQuery } from "./synonyms";
import type { FullTextSearchProvider, SearchHit } from "./types";

/**
 * Recherche PostgreSQL insensible aux accents (configuration `french_unaccent`, cf. migration) :
 *   1. requête stricte (tous les mots, chaque mot étendu à ses synonymes) ;
 *   2. requête élargie (au moins un mot) si rien n'est trouvé.
 * Le titre et les compétences sont aussi testés en ILIKE (tolérance aux libellés exotiques).
 * Les offres expirées / retirées et, hors mode démo, les offres de démonstration sont exclues.
 */
export class PostgresSearchProvider implements FullTextSearchProvider {
  readonly name = "postgres";

  async searchJobs(query: string, options?: { limit?: number }): Promise<SearchHit[]> {
    const limit = options?.limit ?? 400;
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    const demo = isDemoModeEnabled() ? Prisma.sql`TRUE` : Prisma.sql`"isDemo" = false`;
    const strict = buildTsQuery(q, { prefix: true, requireAll: true });
    if (!strict) return [];
    const doc = Prisma.sql`to_tsvector('french_unaccent'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))`;
    const first = await prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id,
        (ts_rank(${doc}, to_tsquery('french_unaccent'::regconfig, ${strict}))
          + (CASE WHEN unaccent(title) ILIKE unaccent(${like}) THEN 0.5 ELSE 0 END))::float AS rank
      FROM job
      WHERE "isActive" = true
        AND "verificationStatus" NOT IN ('EXPIRED', 'REMOVED')
        AND ${demo}
        AND (
          ${doc} @@ to_tsquery('french_unaccent'::regconfig, ${strict})
          OR unaccent(title) ILIKE unaccent(${like})
          OR EXISTS (SELECT 1 FROM unnest("skillsText") s WHERE unaccent(s) ILIKE unaccent(${like}))
        )
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    if (first.length > 0) return first;
    const loose = buildTsQuery(q, { prefix: true, requireAll: false });
    if (!loose || loose === strict) return [];
    return prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id, ts_rank(${doc}, to_tsquery('french_unaccent'::regconfig, ${loose}))::float AS rank
      FROM job
      WHERE "isActive" = true
        AND "verificationStatus" NOT IN ('EXPIRED', 'REMOVED')
        AND ${demo}
        AND ${doc} @@ to_tsquery('french_unaccent'::regconfig, ${loose})
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
  }

  async searchCompanies(query: string, options?: { limit?: number }): Promise<SearchHit[]> {
    const limit = options?.limit ?? 200;
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    const demo = isDemoModeEnabled() ? Prisma.sql`TRUE` : Prisma.sql`"isDemo" = false`;
    const doc = Prisma.sql`to_tsvector('french_unaccent'::regconfig, coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce("nafLabel", ''))`;
    const tsq = buildTsQuery(q, { prefix: true, requireAll: true });
    return prisma.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT id,
        (${tsq ? Prisma.sql`ts_rank(${doc}, to_tsquery('french_unaccent'::regconfig, ${tsq}))` : Prisma.sql`0`}
          + (CASE WHEN unaccent(name) ILIKE unaccent(${like}) THEN 1 ELSE 0 END)
          + similarity(coalesce("nameNormalized", name), unaccent(lower(${q}))))::float AS rank
      FROM company
      WHERE "isPlaceholder" = false
        AND ${demo}
        AND (
          ${tsq ? Prisma.sql`${doc} @@ to_tsquery('french_unaccent'::regconfig, ${tsq})` : Prisma.sql`FALSE`}
          OR unaccent(name) ILIKE unaccent(${like})
          OR similarity(coalesce("nameNormalized", name), unaccent(lower(${q}))) > 0.3
          OR EXISTS (SELECT 1 FROM unnest(technologies) t WHERE t ILIKE ${like})
        )
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
  }
}

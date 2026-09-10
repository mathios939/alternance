/**
 * MESURE DE PERFORMANCE DE LA RECHERCHE (base locale uniquement) :
 * insère N offres synthétiques (préfixe « perf- », employeur « Perf Corp »), exécute EXPLAIN ANALYZE
 * sur les requêtes réelles de la recherche publique et de la couverture, puis supprime tout.
 *
 *   PERF_N=40000 npm run db:perf            # 40 000 offres (défaut)
 *   PERF_PLAN=1 npm run db:perf             # affiche les plans complets
 *
 * Refuse de s'exécuter contre une base distante : jamais de données synthétiques en production.
 */
import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";

const url = process.env["DATABASE_URL"] ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error(
    "db:perf : base non locale, refus (données synthétiques interdites en production).",
  );
  process.exit(2);
}
const N = Number(process.env["PERF_N"] ?? 40000);
const CITIES = [
  ["Nantes", 47.2184, -1.5536, "44000", "Loire-Atlantique", "Pays de la Loire"],
  ["Rennes", 48.1173, -1.6778, "35000", "Ille-et-Vilaine", "Bretagne"],
  ["Paris", 48.8566, 2.3522, "75001", "Paris", "Île-de-France"],
  ["Lyon", 45.764, 4.8357, "69001", "Rhône", "Auvergne-Rhône-Alpes"],
  ["Angers", 47.4784, -0.5632, "49000", "Maine-et-Loire", "Pays de la Loire"],
  ["Brest", 48.3904, -4.4861, "29200", "Finistère", "Bretagne"],
  ["Toulouse", 43.6047, 1.4442, "31000", "Haute-Garonne", "Occitanie"],
  ["Lille", 50.6292, 3.0573, "59000", "Nord", "Hauts-de-France"],
] as const;
const TITLES = [
  "Développeur web en alternance",
  "Assistant comptable en alternance",
  "Chargé de communication en alternance",
  "Technicien de maintenance en alternance",
  "Commercial sédentaire en alternance",
  "Développeur full stack alternance",
  "Data analyst en apprentissage",
  "Assistant RH en alternance",
];
async function main() {
  const t0 = Date.now();
  const company = await prisma.company.upsert({
    where: { slug: "perf-corp" },
    update: {},
    create: {
      slug: "perf-corp",
      name: "Perf Corp",
      nameNormalized: "perf corp",
      sector: "tech",
      size: "PME",
      city: "Nantes",
      isDemo: false,
      dataOrigin: "REAL",
      sizeOrigin: "UNKNOWN",
      technologies: [],
      jobFamilies: [],
    },
  });
  const existing = await prisma.job.count({ where: { slug: { startsWith: "perf-" } } });
  if (existing < N) {
    for (let i = existing; i < N; i += 1000) {
      const rows = [];
      for (let j = i; j < Math.min(N, i + 1000); j++) {
        const c = CITIES[j % CITIES.length]!;
        const title = TITLES[j % TITLES.length]!;
        rows.push({
          slug: `perf-${j}`,
          title,
          normalizedTitle: title.toLowerCase(),
          companyId: company.id,
          description: `${title} à ${c[0]}. Mission : développement, tests, documentation, support utilisateur, participation aux rituels d'équipe. Profil : Bac+2 à Bac+5, rigueur, curiosité. ${j}`,
          missions: [],
          requirements: [],
          benefits: [],
          skillsText: ["React", "Node.js"],
          city: c[0],
          postalCode: c[3],
          department: c[4],
          region: c[5],
          latitude: c[1] + (j % 100) / 1000,
          longitude: c[2] + (j % 50) / 1000,
          jobFamily: "dev",
          sector: "tech",
          publishedAt: new Date(Date.now() - (j % 90) * 86_400_000),
          discoveredAt: new Date(Date.now() - (j % 90) * 86_400_000),
          isActive: true,
          isDemo: false,
          dataOrigin: "REAL" as const,
          verificationStatus: "ACTIVE" as const,
          lastVerifiedAt: new Date(),
          source: "FRANCE_TRAVAIL" as const,
          sourceUrl: `https://example.org/${j}`,
          applicationUrl: `https://example.org/${j}`,
        });
      }
      await prisma.job.createMany({ data: rows });
    }
  }
  const total = await prisma.job.count({ where: { isDemo: false } });
  console.log(`Offres réelles en base : ${total} (préparation ${Date.now() - t0} ms)`);
  await prisma.$executeRawUnsafe("ANALYZE job");
  const explain = async (label: string, sql: Prisma.Sql) => {
    const rows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
      Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    );
    const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
    const time = plan.match(/Execution Time: ([\d.]+) ms/)?.[1];
    const idx = [...plan.matchAll(/Index (?:Only )?Scan(?: Backward)? using (\S+)/g)].map(
      (m) => m[1],
    );
    const bitmap = [...plan.matchAll(/Bitmap Index Scan on (\S+)/g)].map((m) => m[1]);
    console.log(
      `\n== ${label}: ${time} ms · index: ${[...new Set([...idx, ...bitmap])].join(", ") || "aucun (seq scan)"}`,
    );
    if (process.env["PERF_PLAN"]) console.log(plan);
  };
  const vis = Prisma.sql`"isActive" = true AND "canonicalJobId" IS NULL AND "isDemo" = false AND "verificationStatus" NOT IN ('EXPIRED','REMOVED')`;
  await explain(
    "liste nationale (600 plus récentes)",
    Prisma.sql`SELECT id FROM job WHERE ${vis} ORDER BY "publishedAt" DESC LIMIT 600`,
  );
  await explain(
    "rayon 30 km autour de Nantes (bbox) + 600 plus récentes",
    Prisma.sql`SELECT id FROM job WHERE ${vis} AND ((latitude BETWEEN 46.95 AND 47.49 AND longitude BETWEEN -1.95 AND -1.16) OR (latitude IS NULL AND lower(city) = 'nantes') OR remote = 'FULL') ORDER BY "publishedAt" DESC LIMIT 600`,
  );
  await explain(
    "département + publiées < 7 j",
    Prisma.sql`SELECT id FROM job WHERE ${vis} AND department = 'Loire-Atlantique' AND "publishedAt" >= now() - interval '7 days' ORDER BY "publishedAt" DESC LIMIT 600`,
  );
  const doc = Prisma.sql`to_tsvector('french_unaccent'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))`;
  const q = "(developpeur:* | developpeuse:* | developer:* | dev:*)";
  await explain(
    "plein texte « développeur », vecteur recalculé (ancienne requête)",
    Prisma.sql`SELECT id, ts_rank(${doc}, to_tsquery('french_unaccent'::regconfig, ${q}))::float AS rank FROM job WHERE "isActive" = true AND "verificationStatus" NOT IN ('EXPIRED','REMOVED') AND "isDemo" = false AND ${doc} @@ to_tsquery('french_unaccent'::regconfig, ${q}) ORDER BY rank DESC LIMIT 400`,
  );
  await explain(
    "plein texte « développeur », vecteur stocké (requête actuelle : searchVector OR titre normalisé)",
    Prisma.sql`SELECT id, (ts_rank("searchVector", to_tsquery('french_unaccent'::regconfig, ${q})) + (CASE WHEN "normalizedTitle" ILIKE '%developpeur%' THEN 0.5 ELSE 0 END))::float AS rank FROM job WHERE "isActive" = true AND "verificationStatus" NOT IN ('EXPIRED','REMOVED') AND "isDemo" = false AND ("searchVector" @@ to_tsquery('french_unaccent'::regconfig, ${q}) OR "normalizedTitle" ILIKE '%developpeur%') ORDER BY rank DESC, "publishedAt" DESC LIMIT 400`,
  );
  await explain(
    "plein texte « comptable » (terme sélectif), vecteur stocké",
    Prisma.sql`SELECT id, ts_rank("searchVector", to_tsquery('french_unaccent'::regconfig, 'comptable:*'))::float AS rank FROM job WHERE "isActive" = true AND "verificationStatus" NOT IN ('EXPIRED','REMOVED') AND "isDemo" = false AND ("searchVector" @@ to_tsquery('french_unaccent'::regconfig, 'comptable:*') OR "normalizedTitle" ILIKE '%comptable%') ORDER BY rank DESC, "publishedAt" DESC LIMIT 400`,
  );
  await explain(
    "comptage actives (santé / couverture)",
    Prisma.sql`SELECT count(*) FROM job WHERE ${vis}`,
  );
  await explain(
    "groupBy région",
    Prisma.sql`SELECT region, count(*) FROM job WHERE ${vis} GROUP BY region`,
  );
  await explain(
    "découvertes < 24 h",
    Prisma.sql`SELECT count(*) FROM job WHERE ${vis} AND "discoveredAt" >= now() - interval '24 hours'`,
  );
  if (!process.env["PERF_KEEP"]) {
    await prisma.job.deleteMany({ where: { slug: { startsWith: "perf-" } } });
    await prisma.company.deleteMany({ where: { slug: "perf-corp" } });
    console.log("\nDonnées synthétiques supprimées.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

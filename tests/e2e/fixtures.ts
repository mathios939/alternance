import "dotenv/config";
import { Pool } from "pg";

/**
 * Données de bout en bout, à identifiants FIXES et espace de noms « e2e- » :
 * créées dans globalSetup, supprimées dans globalTeardown, et purgées au démarrage suivant
 * si une exécution précédente a été interrompue. Aucune donnée orpheline possible.
 */
export const E2E_USER_EMAIL_PATTERN = "e2e+%@alternance.test";

/** Offre RÉELLE (non démo) avec lien de candidature officiel : les données de démonstration n'en ont volontairement aucun. */
export const VISITOR_FIXTURE = {
  companyId: "e2e-visitor-company",
  companySlug: "e2e-visiteur-atlantique",
  jobId: "e2e-visitor-job",
  jobSlug: "developpeur-web-alternance-parcours-visiteur-e2e",
  jobTitle: "Développeur web en alternance (parcours visiteur)",
  applicationUrl: "https://example.org/candidature-parcours-visiteur-e2e",
} as const;

export function createPool(): Pool {
  return new Pool({ connectionString: process.env["DATABASE_URL"] });
}

/** Supprime tout ce qu'une exécution précédente aurait pu laisser (utilisateurs e2e, fixtures). */
export async function purgeE2EData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM "user" WHERE email LIKE $1', [E2E_USER_EMAIL_PATTERN]);
  await pool.query(`DELETE FROM "job" WHERE id LIKE 'e2e-visitor-%'`);
  await pool.query(`DELETE FROM "company" WHERE id LIKE 'e2e-visitor-%'`);
}

/** Crée (ou remet à l'état attendu) l'offre et l'entreprise du parcours visiteur. Idempotent. */
export async function upsertVisitorFixture(pool: Pool): Promise<void> {
  const f = VISITOR_FIXTURE;
  await pool.query(
    `INSERT INTO "company" (id, slug, name, sector, size, city, department, region, latitude, longitude, "isDemo", "dataOrigin", "sizeOrigin", "hiresApprentices", "jobFamilies", "updatedAt")
     VALUES ($1, $2, 'E2E Visiteur Atlantique', 'tech', 'PME', 'Nantes', 'Loire-Atlantique', 'Pays de la Loire', 47.2184, -1.5536, false, 'REAL', 'UNKNOWN', true, ARRAY['dev'], now())
     ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, "isDemo" = false, "isPlaceholder" = false, "updatedAt" = now()`,
    [f.companyId, f.companySlug],
  );
  await pool.query(
    `INSERT INTO "job" (id, slug, title, "companyId", description, city, department, region, latitude, longitude, "jobFamily", sector, "educationLevelMin", "publishedAt", "applicationUrl", "sourceUrl", "isDemo", "isActive", "dataOrigin", "verificationStatus", "lastVerifiedAt", "updatedAt")
     VALUES ($1, $2, $3, $4,
       'Contrat d''apprentissage de 24 mois à Nantes : développement d''applications web React et Node.js au sein d''une équipe produit, revues de code et tests automatisés. Offre créée par le test de bout en bout du parcours visiteur.',
       'Nantes', 'Loire-Atlantique', 'Pays de la Loire', 47.2184, -1.5536, 'dev', 'tech', 'BAC2', now(), $5, $5, false, true, 'REAL', 'ACTIVE', now(), now())
     ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, "applicationUrl" = EXCLUDED."applicationUrl", "publishedAt" = now(), "isDemo" = false, "isActive" = true, "canonicalJobId" = NULL, "verificationStatus" = 'ACTIVE', "lastVerifiedAt" = now(), "updatedAt" = now()`,
    [f.jobId, f.jobSlug, f.jobTitle, f.companyId, f.applicationUrl],
  );
}

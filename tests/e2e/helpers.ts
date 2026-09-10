import "dotenv/config";
import { Pool } from "pg";
import { expect, type Page } from "@playwright/test";

let pool: Pool | null = null;

/** Accès SQL direct (pg) pour préparer et nettoyer les données de test. */
function db(): Pool {
  pool ??= new Pool({ connectionString: process.env["DATABASE_URL"] });
  return pool;
}

export async function deleteUserByEmail(email: string) {
  await db().query('DELETE FROM "user" WHERE email = $1', [email]);
}

/** Antidate les candidatures envoyées d'un utilisateur pour déclencher les relances. */
export async function backdateSentApplications(email: string, days: number) {
  await db().query(
    `UPDATE "application" a SET "appliedAt" = now() - ($2::int * interval '1 day')
     FROM "user" u WHERE a."userId" = u.id AND u.email = $1 AND a.status = 'SENT'`,
    [email, days],
  );
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

export type VisitorFixture = { companyId: string; companySlug: string; jobId: string; jobSlug: string; applicationUrl: string };

/**
 * Offre RÉELLE (non démo) avec un lien de candidature officiel, pour vérifier qu'un visiteur
 * peut candidater sans compte. Les données de démonstration n'ont volontairement aucun lien actif.
 */
export async function createVisitorFixture(): Promise<VisitorFixture> {
  const stamp = Date.now().toString(36);
  const fixture: VisitorFixture = {
    companyId: `e2e-visitor-company-${stamp}`,
    companySlug: `e2e-visiteur-atlantique-${stamp}`,
    jobId: `e2e-visitor-job-${stamp}`,
    jobSlug: `developpeur-web-alternance-parcours-visiteur-${stamp}`,
    applicationUrl: `https://example.org/candidature-e2e-${stamp}`,
  };
  await db().query(
    `INSERT INTO "company" (id, slug, name, sector, size, city, department, region, latitude, longitude, "isDemo", "dataOrigin", "sizeOrigin", "hiresApprentices", "jobFamilies", "updatedAt")
     VALUES ($1, $2, 'E2E Visiteur Atlantique', 'tech', 'PME', 'Nantes', 'Loire-Atlantique', 'Pays de la Loire', 47.2184, -1.5536, false, 'REAL', 'UNKNOWN', true, ARRAY['dev'], now())`,
    [fixture.companyId, fixture.companySlug],
  );
  await db().query(
    `INSERT INTO "job" (id, slug, title, "companyId", description, city, department, region, latitude, longitude, "jobFamily", sector, "educationLevelMin", "publishedAt", "applicationUrl", "sourceUrl", "isDemo", "dataOrigin", "verificationStatus", "lastVerifiedAt", "updatedAt")
     VALUES ($1, $2, 'Développeur web en alternance (parcours visiteur)', $3,
       'Contrat d''apprentissage de 24 mois à Nantes : développement d''applications web React et Node.js au sein d''une équipe produit, revues de code et tests automatisés. Offre créée par le test de bout en bout du parcours visiteur.',
       'Nantes', 'Loire-Atlantique', 'Pays de la Loire', 47.2184, -1.5536, 'dev', 'tech', 'BAC2', now(), $4, $4, false, 'REAL', 'ACTIVE', now(), now())`,
    [fixture.jobId, fixture.jobSlug, fixture.companyId, fixture.applicationUrl],
  );
  return fixture;
}

export async function deleteVisitorFixture(fixture: VisitorFixture | undefined) {
  if (!fixture) return;
  await db().query('DELETE FROM "job" WHERE id = $1', [fixture.jobId]);
  await db().query('DELETE FROM "company" WHERE id = $1', [fixture.companyId]);
}

export const DEMO = { email: "demo@alternance.demo", password: "Demo1234!" };


/**
 * Connexion robuste : plusieurs connexions rapprochées dans une même suite peuvent être
 * temporairement refusées (limitation de débit) ; on réessaie une fois après une courte pause.
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /Se connecter/ }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard|\/onboarding|\/admin/, { timeout: attempt === 0 ? 30_000 : 60_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(8_000);
    }
  }
}


/** Remet à zéro le quota quotidien de documents IA du compte démo (les suites répétées l'épuisent). */
export async function resetDemoDocuments(email = DEMO.email): Promise<void> {
  await db().query('DELETE FROM "generated_document" WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)', [email]);
}

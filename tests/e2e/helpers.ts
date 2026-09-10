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

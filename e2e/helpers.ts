import "dotenv/config";
import { Pool } from "pg";

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

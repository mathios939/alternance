import { createPool, purgeE2EData } from "./fixtures";

/** Après toute la suite : plus aucune donnée e2e en base (fixtures et comptes créés par les parcours). */
export default async function globalTeardown(): Promise<void> {
  const pool = createPool();
  try {
    await purgeE2EData(pool);
  } finally {
    await pool.end();
  }
}

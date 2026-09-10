import { createPool, purgeE2EData, upsertVisitorFixture } from "./fixtures";

/** Avant toute la suite : purge des restes d'une exécution interrompue, puis fixtures déterministes. */
export default async function globalSetup(): Promise<void> {
  const pool = createPool();
  try {
    await purgeE2EData(pool);
    await upsertVisitorFixture(pool);
  } finally {
    await pool.end();
  }
}

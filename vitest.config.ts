import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Trois familles de tests :
 *   unit        — logique pure, aucune E/S (toujours exécutée : `npm test`) ;
 *   integration — pipeline contre la base locale (DATABASE_URL requis : `npm run test:integration`) ;
 *   external    — scripts réseau (France Travail, IA, OSRM…) volontairement hors Vitest : `npm run test:external`.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { extends: true, test: { name: "integration", include: ["tests/integration/**/*.test.ts"], testTimeout: 60_000 } },
    ],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/services/**", "src/features/**/lib/**"],
    },
  },
});

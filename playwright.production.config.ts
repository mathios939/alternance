import { defineConfig, devices } from "@playwright/test";

/**
 * SMOKE TEST DE PRODUCTION : joue le parcours visiteur contre l'URL PUBLIQUE (PRODUCTION_URL),
 * sans fixture ni accès à la base, sans jamais créer de compte. Desktop et mobile.
 *
 *   PRODUCTION_URL=https://… npx playwright test -c playwright.production.config.ts
 */
const baseURL = process.env["PRODUCTION_URL"];
if (!baseURL) throw new Error("PRODUCTION_URL est requis (URL publique du site).");

export default defineConfig({
  testDir: "./tests/production",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "fr-FR",
    launchOptions: process.env["CHROMIUM_PATH"] ? { executablePath: process.env["CHROMIUM_PATH"] } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

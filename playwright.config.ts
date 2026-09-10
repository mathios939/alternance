import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Fixtures déterministes (offre réelle du parcours visiteur) et purge des données e2e : voir tests/e2e/fixtures.ts
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "fr-FR",
    // Permet d'utiliser un Chromium déjà installé (ex. CHROMIUM_PATH=/opt/pw-browsers/chromium)
    launchOptions: process.env["CHROMIUM_PATH"] ? { executablePath: process.env["CHROMIUM_PATH"] } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env["E2E_BASE_URL"]
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

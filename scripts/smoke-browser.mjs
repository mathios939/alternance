// Smoke test navigateur : connexion démo → dashboard → captures d'écran.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.env.OUT_DIR ?? "./smoke-shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}/01-home.png`, fullPage: false });

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "demo@alternance.demo");
await page.fill("#password", "Demo1234!");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 60000 });
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${out}/02-dashboard.png`, fullPage: true });
const title = await page.textContent("h1");
console.log("Dashboard h1:", title?.trim());

for (const [name, path] of [["03-jobs", "/jobs"], ["04-favorites", "/favorites"], ["05-applications", "/applications"], ["06-companies", "/companies"], ["07-radar", "/radar"], ["08-resume", "/resume"], ["09-outreach", "/outreach"]]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log(path, "→", await page.title());
}
await browser.close();
if (errors.length) { console.log("Erreurs navigateur :"); for (const e of errors) console.log(" -", e); }
else console.log("Aucune erreur navigateur.");

import { expect, test } from "@playwright/test";
import { DEMO, login, resetDemoDocuments } from "./helpers";

test.describe("pages publiques", () => {
  test("accueil, offres, entreprises et pages SEO répondent", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Trouve ton alternance");
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await page.goto("/companies");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("entreprise");
    await page.goto("/alternance/nantes");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nantes");
    await page.goto("/confidentialite");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("confidentialité");
  });
});

test.describe("compte démo", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  });

  test("le tableau de bord affiche la mission et les KPI", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Léa");
    await expect(page.getByText("Ta mission aujourd'hui")).toBeVisible();
    await expect(page.getByText("Meilleurs matchs")).toBeVisible();
  });

  test("les pages de l'application se chargent sans erreur", async ({ page }) => {
    // En dev, chaque page est compilée à la première visite : on laisse le temps nécessaire.
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // L'explorateur d'offres n'a pas de titre de page : on vérifie qu'une carte d'offre s'affiche.
    await page.goto("/jobs?sort=match");
    await expect(page.getByRole("button", { name: /chez/ }).first()).toBeVisible({ timeout: 60_000 });

    for (const [path, heading] of [
      ["/companies", "entreprise"],
      ["/radar", "entreprise"],
      ["/applications", "Candidatures"],
      ["/favorites", "Favoris"],
      ["/resume", "Mon CV"],
      ["/copilot", "Copilote"],
      ["/interviews", "Entretiens"],
      ["/analytics", "Statistiques"],
      ["/outreach", "Outreach"],
      ["/compare", "Comparateur"],
      ["/urgence", "Mode urgence"],
      ["/notifications", "Notifications"],
      ["/settings", "Paramètres"],
      ["/settings/profile", "Paramètres"],
      ["/map", "Carte"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(new RegExp(heading, "i"), { timeout: 60_000 });
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("le copilote répond en streaming (mode démo)", async ({ page }) => {
    await page.goto("/copilot");
    await page.getByRole("button", { name: /Quelles candidatures dois-je relancer/ }).click();
    await expect(page.getByRole("log").getByText(/Candidatures à relancer|relancer/i).first()).toBeVisible({ timeout: 60_000 });
  });

  test("la génération d'une lettre fonctionne (mode démo)", async ({ page, isMobile }) => {
    await resetDemoDocuments();
    await page.goto("/jobs?sort=match");
    await page.getByRole("button", { name: /chez/ }).first().click();
    // Sur mobile, le détail s'ouvre dans un panneau latéral (dialog) ; sur desktop, dans la colonne de droite.
    const pane = isMobile ? page.getByRole("dialog", { name: "Détail de l'offre" }) : page.getByRole("complementary", { name: "Détail de l'offre" });
    await pane.getByRole("button", { name: /Créer une lettre/ }).click();
    await expect(page).toHaveURL(/\/copilot\?intent=cover_letter/);
    await expect(page.getByText(/Objet : Candidature/).first()).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("administration (compte admin)", () => {
  test("qualité des données et sources sont consultables", async ({ page }) => {
    await login(page, "admin@alternance.demo", "Admin1234!");
    // Attendre la fin des redirections client avant de naviguer (sinon net::ERR_ABORTED)
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await page.goto("/admin/data", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: /Qualité des données/ }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/France Travail/).first()).toBeVisible();
    await page.goto("/sources");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("D'où viennent les données");
    await expect(page.getByText(/Non configurée/).first()).toBeVisible();
  });
});

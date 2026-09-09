import { expect, test, type Page } from "@playwright/test";
import { backdateSentApplications, closeDb, deleteUserByEmail } from "./helpers";

/**
 * Parcours critique (§69) :
 * accueil → inscription → onboarding → dashboard → recherche « développeur Nantes » →
 * fiche offre + Match Score → sauvegarde → candidature → Kanban → statut « Envoyée » →
 * relance recommandée.
 */
const email = `e2e+${Date.now()}@alternance.test`;
const password = "E2ePassword123";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await deleteUserByEmail(email);
  await closeDb();
});

async function expectToast(page: Page, text: RegExp | string) {
  await expect(page.getByRole("region", { name: /notifications/i }).getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

test("un nouvel utilisateur trouve, sauvegarde, candidate et se voit proposer une relance", async ({ page, isMobile }) => {
  // Le même parcours est joué sur desktop (3 colonnes) et sur mobile (liste → détail plein écran → retour liste).
  test.setTimeout(300_000);

  // 1. Accueil
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trouve ton alternance");
  await page.getByRole("link", { name: "Commencer gratuitement" }).first().click();

  // 2. Inscription
  await expect(page).toHaveURL(/\/register/);
  await page.fill("#name", "Camille");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: /Commencer gratuitement/ }).click();

  // 3. Onboarding (5 étapes)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
  await expect(page.locator("#firstName")).toHaveValue("Camille");
  await page.fill("#targetJobTitle", "Développeur web");
  await expect(page.getByText("Famille détectée")).toBeVisible();
  await page.getByRole("button", { name: /Continuer/ }).click();

  await page.getByRole("radio", { name: /^Bac\+2/ }).click();
  await page.fill("#educationTitle", "BTS SIO");
  await page.getByRole("button", { name: /Continuer/ }).click();

  await page.fill("#city", "Nantes");
  await page.getByRole("option", { name: /^Nantes/ }).first().click();
  await page.getByRole("button", { name: /Continuer/ }).click();

  await page.getByRole("button", { name: /Continuer/ }).click();

  const skills = page.locator("#skills");
  await skills.fill("React");
  await skills.press("Enter");
  await skills.fill("SQL");
  await skills.press("Enter");
  await page.getByRole("button", { name: /Créer mon assistant/ }).click();

  // 4. Dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Camille");
  await expect(page.getByText("Ta mission aujourd'hui")).toBeVisible();

  // 5. Recherche « développeur Nantes »
  await page.goto("/jobs?q=d%C3%A9veloppeur&city=Nantes");
  const firstCard = page.getByRole("button", { name: /chez/ }).first();
  await expect(firstCard).toBeVisible();
  const cardLabel = (await firstCard.getAttribute("aria-label")) ?? "";
  const companyName = cardLabel.split(" chez ").pop() ?? "";

  // 6-7. Détail de l'offre + Match Score, sans rechargement (colonne de droite sur desktop, panneau plein écran sur mobile)
  await firstCard.click();
  const pane = isMobile ? page.getByRole("dialog", { name: "Détail de l'offre" }) : page.getByRole("complementary", { name: "Détail de l'offre" });
  await expect(pane.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(pane.getByText("Ton score")).toBeVisible();
  await expect(pane.getByText(/\d+\s?%/).first()).toBeVisible();
  await expect(pane.getByText("Pourquoi cette offre te correspond")).toBeVisible();

  // 8. Sauvegarde
  await pane.getByRole("button", { name: /Sauvegarder/ }).click();
  await expectToast(page, /Sauvegardée dans tes favoris/);

  // 9. Candidature
  await pane.getByRole("button", { name: /^Candidater/ }).click();
  await expectToast(page, /Ajoutée à tes candidatures/);

  if (isMobile) {
    // Retour à la liste : la recherche et la position sont conservées (la liste reste montée sous le panneau)
    await pane.getByRole("button", { name: /Retour aux résultats/ }).click();
    await expect(page).toHaveURL(/q=d%C3%A9veloppeur|q=développeur/);
    await expect(firstCard).toBeVisible();
  }

  // 10. Kanban (colonnes défilantes horizontalement sur mobile)
  await page.goto("/applications");
  const toApply = page.getByRole("region", { name: "À candidater" });
  await expect(toApply.getByText(companyName, { exact: true }).first()).toBeVisible();

  // 11. Passage en « Envoyée » depuis la fiche
  await toApply.getByRole("button", { name: `Ouvrir la candidature ${companyName}` }).click();
  await page.getByLabel("Statut").click();
  await page.getByRole("option", { name: "Envoyée" }).click();
  await expectToast(page, /Statut : Envoyée/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Envoyée" }).getByText(companyName, { exact: true }).first()).toBeVisible();

  // 12. Relance recommandée : on antidate l'envoi de 9 jours puis on recharge
  await backdateSentApplications(email, 9);
  await page.reload();
  await expect(page.getByText(/relance recommandée/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Relancé/ }).first()).toBeVisible();

  // Dashboard : le KPI « Relances » compte la candidature à relancer
  await page.goto("/dashboard");
  const followUpsKpi = page.getByRole("link", { name: /Relances/ }).filter({ hasText: "candidatures à relancer" }).first();
  await expect(followUpsKpi).toBeVisible();
  await expect(followUpsKpi).toContainText("1");
});

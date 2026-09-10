import { expect, test, type Page } from "@playwright/test";
import { closeDb, createVisitorFixture, deleteVisitorFixture, type VisitorFixture } from "./helpers";

/**
 * Parcours VISITEUR (sans compte) — joué sur desktop et sur mobile :
 * accueil → recherche « développeur » à Nantes (30 km) → résultats réels → fiche offre → source →
 * retour → personnalisation en 30 s (Match Score sans compte) → favori local → entreprise → Radar →
 * carte → lien de candidature officiel → /dashboard expliqué.
 * À aucun moment un écran de connexion ne doit bloquer le parcours.
 */
test.describe.configure({ mode: "serial" });

let fixture: VisitorFixture | undefined;

test.beforeAll(async () => {
  fixture = await createVisitorFixture();
});

test.afterAll(async () => {
  await deleteVisitorFixture(fixture);
  await closeDb();
});

async function expectToast(page: Page, text: RegExp | string) {
  await expect(page.getByRole("region", { name: /notifications/i }).getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

test("un visiteur cherche, consulte, personnalise, sauvegarde et candidate sans créer de compte", async ({ page, isMobile }) => {
  test.setTimeout(300_000);
  const loginWalls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && /\/(login|register)(\?|$)/.test(frame.url())) loginWalls.push(frame.url());
  });

  // 1. Accueil : recherche immédiate, compte présenté comme optionnel
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trouve ton alternance");
  await expect(page.getByText("Aucun compte nécessaire pour rechercher.")).toBeVisible();
  // Le bandeau cookies (bas d'écran) masquerait des boutons sur mobile : on l'accepte une fois.
  await page.getByRole("dialog", { name: "Information sur les cookies" }).getByRole("button", { name: "Compris" }).click();
  if (!isMobile) {
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Radar" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Carte" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Créer un compte" })).toBeVisible();
  }

  // 2. Recherche « développeur » à Nantes dans un rayon de 30 km
  const search = page.getByRole("search", { name: "Rechercher une alternance" }).first();
  await search.getByPlaceholder("Métier, formation ou compétence").fill("développeur");
  await search.getByPlaceholder("Ville").fill("Nantes");
  await search.getByLabel("Rayon").selectOption("30");
  await search.getByRole("button", { name: "Trouver mon alternance" }).click();
  await expect(page).toHaveURL(/\/jobs\?.*city=Nantes.*radius=30/);

  // 3. Résultats réels, sans compte
  const firstCard = page.getByRole("button", { name: /chez/ }).first();
  await expect(firstCard).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/sur \d+ offres?/)).toBeVisible();

  // 4. Fiche de l'offre (colonne de droite sur desktop, panneau plein écran sur mobile)
  await firstCard.click();
  const pane = isMobile ? page.getByRole("dialog", { name: "Détail de l'offre" }) : page.getByRole("complementary", { name: "Détail de l'offre" });
  await expect(pane.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(pane.getByRole("button", { name: "Personnaliser mes résultats" })).toBeVisible();

  // 5. Source de l'offre (provenance : source, vérification, canal de candidature)
  await expect(pane.getByRole("region", { name: "Provenance des données" })).toContainText("Source :");

  // 6. Retour aux résultats : recherche conservée
  if (isMobile) await pane.getByRole("button", { name: /Retour aux résultats/ }).click();
  await expect(firstCard).toBeVisible();
  await expect(page).toHaveURL(/city=Nantes/);

  // 7. Personnaliser mes résultats (30 secondes, sans compte) → Match Score sur chaque offre
  await page.getByRole("button", { name: "Personnaliser mes résultats" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Personnaliser mes résultats" });
  await dialog.locator("#guest-job").fill("Développeur web");
  await expect(dialog.getByText("Famille détectée")).toBeVisible();
  await dialog.locator("#guest-education").fill("BTS SIO");
  await dialog.getByRole("radio", { name: "Bac+2", exact: true }).click();
  await dialog.locator("#guest-city").fill("Nantes");
  await dialog.getByRole("radio", { name: "30 km" }).click();
  const skills = dialog.locator("#guest-skills");
  await skills.fill("React");
  await skills.press("Enter");
  await dialog.getByRole("button", { name: /Voir mes résultats personnalisés/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Résultats personnalisés" }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Score de compatibilité/ }).first()).toBeVisible({ timeout: 30_000 });

  // 8. Sauvegarder sans compte (stockage navigateur) et retrouver dans /favorites
  await page.getByRole("button", { name: /chez/ }).first().click();
  await expect(pane.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(pane.getByText("Ton score")).toBeVisible();
  const savedTitle = (await pane.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  await pane.getByRole("button", { name: /Sauvegarder/ }).click();
  await expectToast(page, /Sauvegardée dans ce navigateur/);
  await page.goto("/favorites");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Favoris");
  await expect(page.getByText("Sauvegardés dans ce navigateur uniquement.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: savedTitle }).first()).toBeVisible({ timeout: 30_000 });

  // 9. Entreprise : fiche publique, potentiel estimé grâce au profil visiteur
  await page.goto("/companies");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("entreprise");
  await page.locator('article a[aria-label][href^="/companies/"]').first().click();
  await expect(page).toHaveURL(/\/companies\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Potentiel pour toi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contacts publics" })).toBeVisible();

  // 10. Radar, sans compte, avec le profil visiteur
  await page.goto("/radar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/entreprise/i);
  await expect(page.getByText("Nantes").first()).toBeVisible();

  // 11. Carte
  await page.goto("/map");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Carte");

  // 12. Candidater sans compte : le bouton ouvre la destination officielle
  await page.goto(`/jobs/${fixture!.jobSlug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("parcours visiteur");
  const apply = page.getByRole("link", { name: /Candidater sur le site officiel/ }).first();
  await expect(apply).toHaveAttribute("href", fixture!.applicationUrl);
  await expect(apply).toHaveAttribute("target", "_blank");
  const [popup] = await Promise.all([page.waitForEvent("popup"), apply.click()]);
  await popup.close();
  await expect(page).toHaveURL(new RegExp(`/jobs/${fixture!.jobSlug}`));
  // Le suivi est proposé comme un avantage du compte, jamais imposé
  await page.getByRole("button", { name: "Suivre cette candidature" }).first().click();
  const prompt = page.getByRole("dialog", { name: /Crée un compte gratuitement pour sauvegarder et suivre cette candidature/ });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Continuer sans compte" }).click();
  await expect(prompt).toBeHidden();

  // 13. /dashboard sans compte : explication et choix, pas de redirection brutale
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ton espace personnel");
  await expect(page.getByRole("link", { name: /Créer mon espace gratuitement/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continuer sans compte/ })).toBeVisible();

  expect(loginWalls, `écrans de connexion rencontrés : ${loginWalls.join(", ")}`).toEqual([]);
});

test("le Radar sans profil demande la ville en 30 secondes, sans compte", async ({ page }) => {
  await page.goto("/radar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("même sans offre publiée");
  const form = page.getByRole("form", { name: "Personnaliser mes résultats" });
  await form.locator("#guest-city").fill("Nantes");
  await form.locator("#guest-job").fill("Comptable");
  await form.getByRole("button", { name: "Lancer le Radar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/entreprise/i, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/radar/);
});

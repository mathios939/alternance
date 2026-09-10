import { expect, test, type Page } from "@playwright/test";
import { VISITOR_FIXTURE as fixture } from "./fixtures";
import { closeDb, deleteUserByEmail } from "./helpers";

/**
 * Du visiteur au compte, sans rien perdre :
 * profil visiteur + favori local → inscription (destination conservée) → onboarding prérempli →
 * profil enregistré (profil visiteur effacé seulement à ce moment) → retour sur l'offre demandée →
 * « N favoris trouvés » → ajout au compte (idempotent) → favoris du compte.
 */
const email = `e2e+guest-${Date.now()}@alternance.test`;
const password = "E2ePassword123";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await deleteUserByEmail(email);
  await closeDb();
});

async function expectToast(page: Page, text: RegExp | string) {
  await expect(page.getByRole("region", { name: /notifications/i }).getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

test("un visiteur retrouve ses préférences et ses favoris après avoir créé un compte", async ({ page }) => {
  test.setTimeout(300_000);
  const jobUrl = `/jobs/${fixture.jobSlug}`;

  // 1. Sans compte : préférences (profil visiteur) depuis la recherche
  await page.goto("/jobs?q=d%C3%A9veloppeur&city=Nantes&radius=30");
  await page.getByRole("dialog", { name: "Information sur les cookies" }).getByRole("button", { name: "Compris" }).click();
  await page.getByRole("button", { name: "Personnaliser mes résultats" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Personnaliser mes résultats" });
  await dialog.locator("#guest-job").fill("Développeur web");
  await dialog.locator("#guest-education").fill("BTS SIO");
  await dialog.getByRole("radio", { name: "Bac+2", exact: true }).click();
  await dialog.locator("#guest-city").fill("Nantes");
  const skills = dialog.locator("#guest-skills");
  for (const skill of ["React", "SQL"]) {
    await skills.fill(skill);
    await skills.press("Enter");
  }
  await dialog.getByRole("button", { name: /Voir mes résultats personnalisés/ }).click();
  await expect(dialog).toBeHidden();

  // 2. Favori local sur une offre réelle
  await page.goto(jobUrl);
  await page.getByRole("button", { name: /^Sauvegarder$/ }).first().click();
  await expectToast(page, /Sauvegardée dans ce navigateur/);
  expect(await page.evaluate(() => localStorage.getItem("aos.guest-favorites"))).toContain(fixture.jobId);

  // 3. Inscription en gardant la destination
  await page.goto(`/register?next=${encodeURIComponent(jobUrl)}`);
  await page.fill("#name", "Camille");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: /Commencer gratuitement/ }).click();
  await expect(page).toHaveURL(/\/onboarding\?next=/, { timeout: 60_000 });

  // 4. Onboarding prérempli depuis le profil visiteur (qui existe encore : rien n'est effacé avant l'enregistrement)
  await expect(page.locator("#firstName")).toHaveValue("Camille");
  await expect(page.locator("#targetJobTitle")).toHaveValue("Développeur web");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await expect(page.getByRole("radio", { name: /^Bac\+2/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#educationTitle")).toHaveValue("BTS SIO");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await expect(page.locator("#city")).toHaveValue("Nantes");
  // Un refresh en cours d'onboarding repart de l'étape 1 mais conserve le préremplissage
  // (le profil visiteur n'est pas encore effacé) : on retraverse les 4 premières étapes.
  await page.reload();
  await expect(page.locator("#targetJobTitle")).toHaveValue("Développeur web");
  expect((await page.context().cookies()).some((c) => c.name === "aos_guest_profile")).toBe(true);
  for (const step of [2, 3, 4, 5]) {
    await page.getByRole("button", { name: /Continuer/ }).click();
    await expect(page.getByText(`Étape ${step} sur 5`)).toBeVisible();
  }
  const selected = page.getByRole("list", { name: "Compétences sélectionnées" });
  await expect(selected).toContainText("React");
  await expect(selected).toContainText("SQL");
  await page.getByRole("button", { name: /Créer mon assistant/ }).click();

  // 5. Retour sur l'offre demandée ; le profil visiteur a été repris puis effacé
  await expect(page).toHaveURL(new RegExp(jobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("parcours visiteur");
  await expect(page.getByText("Ton score")).toBeVisible({ timeout: 30_000 });
  expect((await page.context().cookies()).some((c) => c.name === "aos_guest_profile")).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("aos.guest-profile"))).toBeNull();

  // 6. Les favoris locaux sont détectés et proposés, jamais importés à l'insu de l'utilisateur
  const banner = page.getByRole("status").filter({ hasText: "favori" });
  await expect(banner).toContainText("1 favori trouvé");
  await banner.getByRole("button", { name: "Ajouter à mon compte" }).click();
  await expectToast(page, /Favoris ajoutés à ton compte/);
  await expect(banner).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("aos.guest-favorites"))).toBeNull();

  // 7. Le favori est dans le compte, une seule fois
  await page.goto("/favorites");
  await expect(page.getByRole("heading", { level: 3, name: fixture.jobTitle })).toHaveCount(1);

  // 8. Idempotence : un ancien stockage local réapparaît (autre onglet, restauration) → rien n'est dupliqué
  await page.evaluate((jobId) => localStorage.setItem("aos.guest-favorites", JSON.stringify({ jobs: [jobId], companies: [] })), fixture.jobId);
  await page.reload();
  const again = page.getByRole("status").filter({ hasText: "favori" });
  await expect(again).toContainText("1 favori trouvé");
  await again.getByRole("button", { name: "Ajouter à mon compte" }).click();
  await expectToast(page, /Ces favoris étaient déjà dans ton compte/);
  await expect(page.getByRole("heading", { level: 3, name: fixture.jobTitle })).toHaveCount(1);
});

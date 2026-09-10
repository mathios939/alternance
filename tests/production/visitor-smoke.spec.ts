import { expect, test, type Page } from "@playwright/test";

/**
 * PARCOURS VISITEUR EN PRODUCTION (URL publique, vraies données, aucun compte) :
 * pages publiques en 200 → recherche « développeur » à Nantes (30 km) → vraie offre France Travail
 * (source, lien d'origine, lien de candidature officiel, badge REAL) → favori local conservé après
 * rechargement → personnalisation conservée après rechargement → entreprise → Radar → carte →
 * /dashboard expliqué → santé. Ne crée rien côté serveur ; ne modifie aucune donnée.
 */
const PUBLIC_PAGES = [
  "/",
  "/jobs",
  "/companies",
  "/radar",
  "/map",
  "/compare",
  "/favorites",
  "/dashboard",
  "/sources",
] as const;

async function acceptCookies(page: Page) {
  const banner = page.getByRole("dialog", { name: "Information sur les cookies" });
  if (await banner.isVisible().catch(() => false))
    await banner.getByRole("button", { name: "Compris" }).click({ timeout: 10_000 });
}

async function expectToast(page: Page, text: RegExp | string) {
  await expect(
    page
      .getByRole("region", { name: /notifications/i })
      .getByText(text)
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

/**
 * Le bandeau cookies est mémorisé dans localStorage : il est accepté AVANT la navigation pour que le
 * parcours ne dépende pas d'un clic sur un bandeau flottant (son fonctionnement est couvert par les
 * tests e2e locaux). Le débordement horizontal, lui, est vérifié explicitement sur mobile.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        "aos.cookie-consent",
        JSON.stringify({ value: "essential", at: new Date().toISOString() }),
      );
    } catch {}
  });
});

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const info = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > cw + 1 && getComputedStyle(el).position !== "fixed") {
        const cls = typeof el.className === "string" ? el.className.slice(0, 80) : "";
        offenders.push(
          `${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} « ${(el.textContent ?? "").trim().slice(0, 40)} »`,
        );
      }
    }
    return {
      overflow: document.documentElement.scrollWidth - cw,
      offenders: offenders.slice(0, 10),
    };
  });
  expect(
    info.overflow,
    `débordement horizontal sur ${label} (${info.overflow}px) : ${info.offenders.join(" | ")}`,
  ).toBeLessThanOrEqual(1);
}

test("les pages publiques répondent en 200 sans redirection vers la connexion", async ({
  request,
}) => {
  for (const path of PUBLIC_PAGES) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const body = (await health.json()) as {
    app: string;
    database: string;
    demoMode: boolean;
    services: Record<string, string>;
    data: { realActiveJobs: number; companies: number } | null;
  };
  expect(body.app).toBe("healthy");
  expect(body.database).toBe("healthy");
  expect(body.demoMode).toBe(false);
  expect(body.services["franceTravail"]).toBe("configured");
  expect(body.services["companyData"]).toBe("available");
  expect(body.data?.realActiveJobs ?? 0).toBeGreaterThan(0);
  expect(body.data?.companies ?? 0).toBeGreaterThan(0);
  // Les fonctionnalités privées, elles, renvoient vers la connexion en conservant la destination
  const priv = await request.get("/applications", { maxRedirects: 0 });
  expect([302, 307]).toContain(priv.status());
  expect(priv.headers()["location"]).toMatch(/\/login\?next=%2Fapplications/);
});

test("un visiteur cherche, ouvre une vraie offre, la sauvegarde, personnalise et candidate sans compte", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(300_000);
  const loginWalls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && /\/(login|register)(\?|$)/.test(frame.url()))
      loginWalls.push(frame.url());
  });

  // 1. Accueil et recherche « développeur » à Nantes (30 km)
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trouve ton alternance");
  await acceptCookies(page);
  if (isMobile) await expectNoHorizontalOverflow(page, "l'accueil");
  const search = page.getByRole("search", { name: "Rechercher une alternance" }).first();
  await search.getByPlaceholder("Métier, formation ou compétence").fill("développeur");
  await search.getByPlaceholder("Ville").fill("Nantes");
  await search.getByLabel("Rayon").selectOption("30");
  await search.getByRole("button", { name: "Trouver mon alternance" }).click();
  await expect(page).toHaveURL(/\/jobs\?.*city=Nantes.*radius=30/);
  // Résultats exacts ou état vide explicite : jamais d'offres hors sujet mélangées en silence
  const results = page.getByRole("button", { name: /chez/ });
  const empty = page.getByText("Aucune offre ne correspond");
  await expect(results.first().or(empty)).toBeVisible({ timeout: 60_000 });
  const exactCount = await results.count();
  expect(exactCount > 0 || (await empty.isVisible())).toBe(true);
  await expect(page.getByText("Démo", { exact: true })).toHaveCount(0);
  if (isMobile) await expectNoHorizontalOverflow(page, "la recherche");

  // 2. Une vraie offre d'alternance autour de Nantes (toutes offres du rayon si le mot-clé n'en donne pas)
  if (exactCount === 0) await page.goto("/jobs?city=Nantes&radius=30");
  const firstCard = page.getByRole("button", { name: /chez/ }).first();
  await expect(firstCard).toBeVisible({ timeout: 60_000 });
  await firstCard.click();
  const pane = isMobile
    ? page.getByRole("dialog", { name: "Détail de l'offre" })
    : page.getByRole("complementary", { name: "Détail de l'offre" });
  await expect(pane.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  const provenance = pane.getByRole("region", { name: "Provenance des données" });
  await expect(provenance).toContainText("France Travail");
  await expect(provenance.getByRole("link", { name: /annonce d'origine/ })).toHaveAttribute(
    "href",
    /^https?:\/\//,
  );
  await expect(pane.getByText("Démo", { exact: true })).toHaveCount(0);
  const title = (await pane.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  expect(title.length).toBeGreaterThan(3);

  // 3. Favori sans compte, conservé après rechargement
  await pane.getByRole("button", { name: /^Sauvegarder$/ }).click();
  await expectToast(page, /Sauvegardée dans ce navigateur/);
  await page.reload();
  await page.goto("/favorites");
  await expect(page.getByRole("heading", { level: 3, name: title }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Sauvegardés dans ce navigateur uniquement.")).toBeVisible();

  // 4. Personnalisation sans compte, conservée après rechargement → Match Score sur les offres
  await page.goto("/jobs?city=Nantes&radius=30");
  await acceptCookies(page);
  await page.getByRole("button", { name: "Personnaliser mes résultats" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Personnaliser mes résultats" });
  await dialog.locator("#guest-job").fill("Développeur web");
  await dialog.getByRole("radio", { name: "Bac+2", exact: true }).click();
  await dialog.locator("#guest-city").fill("Nantes");
  const skills = dialog.locator("#guest-skills");
  await skills.fill("React");
  await skills.press("Enter");
  await dialog.getByRole("button", { name: /Voir mes résultats personnalisés/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("img", { name: /Score de compatibilité/ }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Résultats personnalisés" }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("img", { name: /Score de compatibilité/ }).first()).toBeVisible({
    timeout: 30_000,
  });
  const guestCookie = (await page.context().cookies()).find((c) => c.name === "aos_guest_profile");
  expect(guestCookie).toBeDefined();
  expect(guestCookie!.expires - Date.now() / 1000).toBeGreaterThan(80 * 86_400);
  expect(guestCookie!.expires - Date.now() / 1000).toBeLessThan(91 * 86_400);

  // 5. Fiche offre en pleine page : lien de candidature officiel sans compte, badge REAL
  await page.getByRole("button", { name: /chez/ }).first().click();
  const pane2 = isMobile
    ? page.getByRole("dialog", { name: "Détail de l'offre" })
    : page.getByRole("complementary", { name: "Détail de l'offre" });
  await expect(pane2.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  const fullPage = isMobile ? null : pane2.getByRole("link", { name: /Ouvrir en pleine page/ });
  if (fullPage) await fullPage.click();
  else {
    const href = await pane2
      .getByRole("link", { name: /Candidater sur le site officiel/ })
      .first()
      .getAttribute("href");
    expect(href).toMatch(/^https?:\/\//);
    await pane2.getByRole("button", { name: /Retour aux résultats/ }).click();
    const slugLink = page.getByRole("link", { name: "Voir l'offre" }).first();
    await slugLink.click();
  }
  await expect(page).toHaveURL(/\/jobs\/[^/?]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Ton score")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Donnée vérifiée").first()).toBeVisible();
  const apply = page.getByRole("link", { name: /Candidater sur le site officiel/ }).first();
  await expect(apply).toHaveAttribute("href", /^https?:\/\//);
  await expect(apply).toHaveAttribute("target", "_blank");
  const [popup] = await Promise.all([page.waitForEvent("popup"), apply.click()]);
  await popup.close();
  await expect(page).toHaveURL(/\/jobs\/[^/?]+$/);

  // 6. Entreprise, Radar, carte, espace personnel expliqué
  await page.goto("/companies");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("entreprise");
  await page.locator('article a[aria-label][href^="/companies/"]').first().click();
  await expect(page).toHaveURL(/\/companies\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Démo", { exact: true })).toHaveCount(0);
  await page.goto("/radar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/entreprise/i, {
    timeout: 30_000,
  });
  await page.goto("/map");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Carte");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ton espace personnel");
  await expect(page.getByRole("link", { name: /Continuer sans compte/ })).toBeVisible();

  expect(loginWalls, `écrans de connexion rencontrés : ${loginWalls.join(", ")}`).toEqual([]);
});

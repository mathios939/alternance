/**
 * TEST EXTERNE — API Recherche d'entreprises (open data, sans clé, réseau requis).
 *   npm run test:companies -- --q informatique --department 44
 * Vérifie : disponibilité, recherche par NAF + département, structure des fiches, rapprochement SIREN.
 */
import { EXIT, fail, heading, info, ok, parseArgs, runMain, str, warn } from "./lib/bootstrap";

runMain(async () => {
  const args = parseArgs();
  const { RechercheEntreprisesProvider, CompanyApiError } = await import("../src/services/company-data");
  const provider = new RechercheEntreprisesProvider();
  const department = str(args["department"]) ?? "44";
  const text = str(args["q"]);

  heading("1. Recherche d'entreprises informatiques (NAF 62.01Z / 62.02A)");
  try {
    const t0 = Date.now();
    const page = await provider.search({ text, nafCodes: ["62.01Z", "62.02A"], departmentCodes: [department], perPage: 10 });
    ok(`${page.results.length} fiche(s) sur ${page.total ?? "?"} en ${Date.now() - t0} ms`);
    for (const r of page.results.slice(0, 5)) info(`${r.siren} · ${r.brandName ?? r.legalName} · ${r.city ?? "?"} (${r.postalCode ?? "?"}) · NAF ${r.nafCode ?? "?"} · effectif ${r.employeeRangeLabel ?? "non renseigné"} · ${r.latitude !== null ? "géolocalisée" : "sans coordonnées"}`);
    const withCoords = page.results.filter((r) => r.latitude !== null).length;
    (withCoords > 0 ? ok : warn)(`${withCoords}/${page.results.length} fiches géolocalisées`);
    if (page.results[0]) {
      heading("2. Rapprochement par SIREN");
      const one = await provider.getBySiren(page.results[0].siren);
      (one ? ok : fail)(one ? `${one.siren} → ${one.legalName} (${one.sourceUrl})` : "Fiche introuvable par SIREN");
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    if (error instanceof CompanyApiError && (error.code === "NETWORK" || error.code === "TIMEOUT")) info("L'API n'est pas joignable depuis cet environnement (proxy / pare-feu ?).");
    return EXIT.FAILED;
  }
  heading("Résultat");
  ok("API Recherche d'entreprises exploitable : lance `npm run companies:import` pour peupler la base.");
  return EXIT.OK;
});

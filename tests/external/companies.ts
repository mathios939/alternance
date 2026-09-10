/**
 * TEST EXTERNE — API Recherche d'entreprises (open data SIRENE, sans clé, réseau requis).
 *
 *   npm run test:companies [-- --department 44 --q informatique]
 *
 * Deux requêtes seulement : une recherche très limitée (5 fiches, NAF numérique, un département)
 * puis un rapprochement par SIREN sur la première fiche. Jamais de récupération massive.
 */
import { parseArgs, str } from "../../scripts/lib/bootstrap";
import { invalidResponse, isHttpUrl, notConfigured, runExternalTest } from "./lib/harness";

void runExternalTest("API Recherche d'entreprises", "companies", async (ctx) => {
  const args = parseArgs();
  const department = str(args["department"]) ?? "44";
  const text = str(args["q"]);
  ctx.detail("provider", "recherche-entreprises");
  ctx.detail("query", `NAF 62.01Z,62.02A · département ${department}${text ? ` · « ${text} »` : ""} · 5 fiches max`);

  const { RechercheEntreprisesProvider } = await import("../../src/services/company-data");
  const provider = new RechercheEntreprisesProvider({ timeoutMs: 15_000, maxRetries: 1 });

  await ctx.step("Configuration", async () => {
    const status = await provider.status();
    if (!status.configured) notConfigured(status.reason ?? "Fournisseur désactivé (COMPANY_DATA_PROVIDER=none)");
    return "aucune clé requise (open data)";
  });

  let siren: string | null = null;
  await ctx.step("Recherche limitée (entreprises informatiques)", async () => {
    const t0 = Date.now();
    const page = await provider.search({ text, nafCodes: ["62.01Z", "62.02A"], departmentCodes: [department], perPage: 5 });
    ctx.detail("latencyMs", Date.now() - t0);
    ctx.detail("count", page.results.length);
    ctx.detail("total", page.total);
    if (page.results.length === 0) invalidResponse("Aucune fiche renvoyée pour une recherche qui devrait en produire (NAF 62 dans un département actif)");
    const first = page.results[0]!;
    if (!/^\d{9}$/.test(first.siren) || !first.legalName) invalidResponse("Fiche sans SIREN valide ou sans raison sociale");
    if (!isHttpUrl(first.sourceUrl)) invalidResponse("URL de source invalide");
    const withCoords = page.results.filter((r) => r.latitude !== null).length;
    // Le filtre département porte sur les établissements : le siège peut être ailleurs.
    const localSites = page.results.filter((r) => r.establishments.some((e) => e.departmentCode === department)).length;
    ctx.detail("geolocated", `${withCoords}/${page.results.length}`);
    ctx.detail("localEstablishments", `${localSites}/${page.results.length}`);
    for (const r of page.results) {
      const local = r.establishments.find((e) => e.departmentCode === department);
      ctx.info(`${r.siren} · ${(r.brandName ?? r.legalName).slice(0, 50)} · siège ${r.city ?? "?"} (${r.postalCode ?? "?"})${local ? ` · établissement ${local.city ?? "?"} (${local.postalCode ?? "?"})${local.latitude !== null ? ", géolocalisé" : ""}` : " · aucun établissement local renvoyé"} · NAF ${r.nafCode ?? "?"} · effectif ${r.employeeRangeLabel ?? "non renseigné"}`);
    }
    if (localSites === 0) ctx.warn(`Aucune fiche ne renvoie d'établissement dans le département ${department} : le champ matching_etablissements est peut-être absent de la réponse.`);
    siren = first.siren;
    return `${page.results.length} fiche(s) sur ${page.total ?? "?"}, ${withCoords} géolocalisée(s), ${localSites} avec établissement en ${department}`;
  });

  await ctx.step("Rapprochement par SIREN", async () => {
    if (!siren) return "ignoré (aucune fiche)";
    const t0 = Date.now();
    const one = await provider.getBySiren(siren);
    if (!one) invalidResponse(`SIREN ${siren} introuvable alors qu'il vient d'être renvoyé`);
    return `${one.siren} → ${one.legalName.slice(0, 50)} (${Date.now() - t0} ms)`;
  });
});

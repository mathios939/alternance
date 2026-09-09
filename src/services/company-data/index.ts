import { RechercheEntreprisesProvider } from "./providers/recherche-entreprises";
import type { CompanyDataProvider } from "./types";

export * from "./types";
export * from "./naf";
export { RechercheEntreprisesProvider, CompanyApiError, mapRechercheEntreprise, rechercheEntrepriseSchema } from "./providers/recherche-entreprises";

/** Registre des fournisseurs de données d'entreprises (open data officiel uniquement). */
export function getCompanyDataProviders(): CompanyDataProvider[] {
  return [new RechercheEntreprisesProvider()];
}

export function getCompanyDataProvider(key = "recherche-entreprises"): CompanyDataProvider | undefined {
  return getCompanyDataProviders().find((p) => p.key === key);
}

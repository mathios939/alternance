import { CompanyCareerProvider, parseCareerFeeds } from "./providers/company-career";
import { FranceTravailProvider } from "./providers/france-travail";
import { LaBonneAlternanceProvider } from "./providers/la-bonne-alternance";
import { ManualProvider } from "./providers/manual";
import type { JobSourceProvider } from "./types";

export * from "./types";
export * from "./normalize";
export * from "./dedupe";
export { ManualProvider, CompanyCareerProvider, FranceTravailProvider, LaBonneAlternanceProvider };

/**
 * Registre des providers actifs. L'ajout d'une source = une classe + une ligne ici.
 * Chaque provider déclare ses capabilities et sa priorité (source canonique de candidature).
 */
export function getJobSourceProviders(env: NodeJS.ProcessEnv = process.env): JobSourceProvider[] {
  return [
    new FranceTravailProvider({
      clientId: env["FRANCE_TRAVAIL_CLIENT_ID"],
      clientSecret: env["FRANCE_TRAVAIL_CLIENT_SECRET"],
      natureContratCodes: env["FRANCE_TRAVAIL_NATURE_CONTRAT"]
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      maxResults: env["FRANCE_TRAVAIL_MAX_RESULTS"]
        ? Number(env["FRANCE_TRAVAIL_MAX_RESULTS"])
        : undefined,
    }),
    // Deuxième source réelle : API Alternance (La bonne alternance), licence Etalab-2.0, clé d'API gratuite.
    new LaBonneAlternanceProvider({
      apiKey: env["LA_BONNE_ALTERNANCE_API_KEY"],
      keyType: env["LA_BONNE_ALTERNANCE_KEY_TYPE"],
    }),
    new CompanyCareerProvider(parseCareerFeeds(env["CAREER_FEEDS_JSON"])),
    new ManualProvider(),
  ];
}

export function getJobSourceProvider(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): JobSourceProvider | undefined {
  return getJobSourceProviders(env).find((p) => p.key === key);
}

import { CompanyCareerProvider } from "./providers/company-career";
import { FranceTravailProvider } from "./providers/france-travail";
import { ManualProvider } from "./providers/manual";
import type { JobSourceProvider } from "./types";

export * from "./types";
export * from "./normalize";
export * from "./dedupe";
export { ManualProvider, CompanyCareerProvider, FranceTravailProvider };

/** Registre des providers actifs. L'ajout d'une source = une classe + une ligne ici. */
export function getJobSourceProviders(): JobSourceProvider[] {
  return [
    new ManualProvider(),
    new CompanyCareerProvider([]),
    new FranceTravailProvider({
      clientId: process.env["FRANCE_TRAVAIL_CLIENT_ID"],
      clientSecret: process.env["FRANCE_TRAVAIL_CLIENT_SECRET"],
    }),
  ];
}

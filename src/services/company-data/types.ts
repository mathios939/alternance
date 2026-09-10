/**
 * COUCHE ENTREPRISES RÉELLES (Phase 8-9).
 * Chaque fournisseur de données d'entreprise (open data, SIRENE, sites officiels) implémente
 * CompanyDataProvider et déclare ses capabilities. Rien n'est inventé : les champs absents restent null.
 */
export type CompanyProviderCapabilities = {
  supportsTextSearch: boolean;
  supportsNafFilter: boolean;
  supportsGeoFilter: boolean;
  supportsSirenLookup: boolean;
  providesCoordinates: boolean;
  providesHeadcount: boolean;
  providesWebsite: boolean;
};

export type CompanySearchParams = {
  text?: string;
  /** Codes NAF (ex. « 62.01Z »), combinés en OR. */
  nafCodes?: string[];
  /** Section NAF (lettre, ex. « J »). */
  nafSection?: string;
  departmentCodes?: string[];
  regionCode?: string;
  postalCode?: string;
  /** Codes de tranche d'effectif INSEE minimale (ex. « 03 » = 6 à 9 salariés). */
  minEmployeeRange?: string;
  page?: number;
  perPage?: number;
};

/** Établissement (site) d'une entreprise ; le siège peut être hors de la zone recherchée. */
export type CompanyEstablishment = {
  siret: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  inseeCode: string | null;
  departmentCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isHeadquarters: boolean;
};

export type CompanyRecord = {
  siren: string;
  siret: string | null;
  legalName: string;
  brandName: string | null;
  nafCode: string | null;
  nafLabel: string | null;
  legalCategory: string | null;
  employeeRange: string | null;
  employeeRangeLabel: string | null;
  headcountEstimate: number | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  inseeCode: string | null;
  departmentCode: string | null;
  latitude: number | null;
  longitude: number | null;
  registeredAt: Date | null;
  isActive: boolean;
  /** Catégorie INSEE : PME / ETI / GE. */
  category: string | null;
  website: string | null;
  sourceUrl: string;
  /** Établissements ayant satisfait le filtre géographique de la recherche (peut être vide). */
  establishments: CompanyEstablishment[];
  raw?: unknown;
};

export type CompanySearchPage = { results: CompanyRecord[]; total: number | null; page: number; totalPages: number | null; requests: number; warnings: string[] };

export type CompanyProviderStatus = { key: string; name: string; configured: boolean; reason?: string; missing?: string[] };

export interface CompanyDataProvider {
  readonly key: string;
  readonly name: string;
  readonly capabilities: CompanyProviderCapabilities;
  status(): Promise<CompanyProviderStatus>;
  search(params: CompanySearchParams): Promise<CompanySearchPage>;
  getBySiren?(siren: string): Promise<CompanyRecord | null>;
}

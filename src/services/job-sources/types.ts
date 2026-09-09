import type { ContractType, EducationLevel, JobSourceType, RemotePolicy, WorkRhythm } from "@/generated/prisma/enums";

/**
 * Format brut renvoyé par un fournisseur d'offres, avant normalisation.
 * Chaque provider mappe sa source vers ce format ; la normalisation est commune.
 */
export type RawJob = {
  externalId: string;
  title: string;
  companyName: string;
  companyWebsite?: string | null;
  description: string;
  missions?: string[];
  requirements?: string[];
  benefits?: string[];
  skills?: string[];
  city: string;
  postalCode?: string | null;
  department?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contractType?: ContractType | null;
  educationLevelMin?: EducationLevel | null;
  educationLevelMax?: EducationLevel | null;
  durationMonths?: number | null;
  rhythm?: WorkRhythm | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  remote?: RemotePolicy | null;
  startDate?: Date | null;
  publishedAt: Date;
  expiresAt?: Date | null;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
  sector?: string | null;
  jobFamily?: string | null;
  raw?: unknown;
};

/** Offre normalisée : format interne unique, quel que soit le fournisseur. */
export type NormalizedJob = {
  externalId: string;
  title: string;
  slugBase: string;
  companyName: string;
  companyNameNormalized: string;
  companyWebsite: string | null;
  description: string;
  missions: string[];
  requirements: string[];
  benefits: string[];
  skillsText: string[];
  skillSlugs: string[];
  city: string;
  postalCode: string | null;
  department: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  contractType: ContractType;
  educationLevelMin: EducationLevel | null;
  educationLevelMax: EducationLevel | null;
  durationMonths: number | null;
  rhythm: WorkRhythm | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remote: RemotePolicy;
  startDate: Date | null;
  publishedAt: Date;
  expiresAt: Date | null;
  source: JobSourceType;
  sourceKey: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  sector: string;
  jobFamily: string;
  isDemo: boolean;
  raw: unknown;
};

export type FetchParams = {
  keywords?: string;
  city?: string;
  region?: string;
  limit?: number;
  since?: Date;
};

export type ProviderStatus = {
  key: string;
  name: string;
  type: JobSourceType;
  configured: boolean;
  reason?: string;
};

/**
 * Contrat que chaque source d'offres doit respecter.
 * Règle absolue : n'utiliser que des sources légales (API officielle, flux fournis,
 * pages carrières autorisées). Jamais de scraping en violation des CGU.
 */
export interface JobSourceProvider {
  readonly key: string;
  readonly name: string;
  readonly type: JobSourceType;
  /** Indique si le provider dispose de tout ce qu'il faut (clés, config). */
  status(): Promise<ProviderStatus>;
  fetchJobs(params: FetchParams): Promise<RawJob[]>;
}

export type IngestReport = {
  sourceKey: string;
  fetched: number;
  created: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: string[];
};

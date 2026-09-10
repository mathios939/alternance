import type {
  ContractType,
  EducationLevel,
  JobSourceType,
  RemotePolicy,
  SalaryPeriod,
  WorkRhythm,
} from "@/generated/prisma/enums";

/**
 * Format brut renvoyé par un fournisseur d'offres, avant normalisation.
 * Chaque provider mappe sa source vers ce format ; la normalisation est commune.
 * Règle : aucun champ n'est deviné par le provider. Ce qui n'est pas dans la source reste absent.
 */
export type RawJob = {
  externalId: string;
  title: string;
  companyName: string | null;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  companyLogoUrl?: string | null;
  description: string;
  missions?: string[];
  requirements?: string[];
  benefits?: string[];
  skills?: string[];
  city: string | null;
  postalCode?: string | null;
  inseeCode?: string | null;
  department?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contractType?: ContractType | null;
  /** true si la source déclare explicitement une alternance. */
  isAlternance?: boolean | null;
  educationLevelMin?: EducationLevel | null;
  educationLevelMax?: EducationLevel | null;
  durationMonths?: number | null;
  rhythm?: WorkRhythm | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  remote?: RemotePolicy | null;
  startDate?: Date | null;
  publishedAt: Date;
  updatedAt?: Date | null;
  expiresAt?: Date | null;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
  /** Canal de candidature publié par l'annonceur (jamais deviné). */
  applicationEmail?: string | null;
  applicationLabel?: string | null;
  sector?: string | null;
  jobFamily?: string | null;
  romeCode?: string | null;
  nafCode?: string | null;
  positionsCount?: number | null;
  raw?: unknown;
};

/** Offre normalisée : format interne unique, quel que soit le fournisseur. */
export type NormalizedJob = {
  externalId: string;
  title: string;
  normalizedTitle: string;
  slugBase: string;
  companyName: string;
  companyNameRaw: string | null;
  companyNameNormalized: string;
  companyWebsite: string | null;
  companyDescription: string | null;
  companyLogoUrl: string | null;
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
  salaryPeriod: SalaryPeriod | null;
  remote: RemotePolicy;
  startDate: Date | null;
  publishedAt: Date;
  updatedAt: Date | null;
  expiresAt: Date | null;
  source: JobSourceType;
  sourceKey: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  applicationEmail: string | null;
  applicationLabel: string | null;
  sector: string;
  jobFamily: string;
  romeCode: string | null;
  nafCode: string | null;
  positionsCount: number | null;
  isDemo: boolean;
  raw: unknown;
};

export type FetchParams = {
  keywords?: string;
  city?: string;
  /** Code INSEE de commune (prioritaire sur `city` si fourni). */
  inseeCode?: string;
  radiusKm?: number;
  department?: string;
  region?: string;
  limit?: number;
  since?: Date;
  /** Nombre de jours max depuis la publication (si la source le supporte). */
  publishedWithinDays?: number;
  /** Borne haute de date de création (fenêtre temporelle explicite, avec `since`). */
  until?: Date;
  /** Sous-ensemble de natures de contrat à demander à la source (découpe d'une fenêtre tronquée). */
  contractNatures?: string[];
  /** Priorité dans la file du quota manager. */
  priority?: "live" | "recent" | "verify" | "backfill";
  /** Si la source annonce plus de résultats que `limit`, ne rien récupérer (l'appelant découpera la fenêtre). */
  stopIfTruncated?: boolean;
};

/** Ce qu'une source sait faire. Déclaré explicitement pour ne rien supposer (Phase 14). */
export type ProviderCapabilities = {
  supportsSearch: boolean;
  supportsIncrementalSync: boolean;
  supportsLocation: boolean;
  supportsRadius: boolean;
  supportsDetails: boolean;
  supportsSalary: boolean;
  supportsExpiration: boolean;
  /** Vérification d'existence d'une offre (détection des retraits). */
  supportsVerification: boolean;
};

export type ProviderStatus = {
  key: string;
  name: string;
  type: JobSourceType;
  configured: boolean;
  reason?: string;
  /** Variables d'environnement manquantes, listées explicitement. */
  missing?: string[];
};

export type FetchPage = {
  jobs: RawJob[];
  /** Nombre total annoncé par la source, si connu. */
  total: number | null;
  /** Nombre de requêtes HTTP effectuées. */
  requests: number;
  /** Avertissements non bloquants (offres ignorées par la source, pages tronquées…). */
  warnings: string[];
  /** La source annonçait plus de résultats que ce qui a pu être récupéré (borne de pagination). */
  truncated?: boolean;
};

export type VerificationResult = {
  externalId: string;
  status: "ACTIVE" | "REMOVED" | "UNKNOWN";
  job?: RawJob | null;
  error?: string;
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
  readonly capabilities: ProviderCapabilities;
  /** Priorité pour la source canonique de candidature (page carrière > source officielle > agrégateur). */
  readonly priority: number;
  /** Indique si le provider dispose de tout ce qu'il faut (clés, config). Ne bascule jamais en simulation. */
  status(): Promise<ProviderStatus>;
  fetchJobs(params: FetchParams): Promise<FetchPage>;
  /** Détail / existence d'une offre. `job: null` = retirée de la source. */
  verifyJobs?(externalIds: string[]): Promise<VerificationResult[]>;
  /** Codes de nature de contrat alternance de la source (découpe d'une fenêtre tronquée par nature). */
  contractNatures?(): Promise<string[]>;
}

export type IngestReport = {
  sourceKey: string;
  runId: string | null;
  fetched: number;
  created: number;
  /** Offres déjà connues revues dans ce lot (dont `unchanged`, non réécrites). */
  updated: number;
  /** Offres revues dont la source n'a pas changé la date d'actualisation : simple pointage. */
  unchanged: number;
  duplicates: number;
  rejected: number;
  failed: number;
  errors: string[];
  warnings: string[];
  durationMs: number;
  /** Total annoncé par la source, requêtes HTTP effectuées, troncature éventuelle. */
  total: number | null;
  requests: number;
  truncated: boolean;
};

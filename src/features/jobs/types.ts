import type { ContractType, EducationLevel, RemotePolicy, WorkRhythm, ApplicationStatus, CompanySize, DataOrigin, JobVerificationStatus, SalaryPeriod } from "@/generated/prisma/enums";
import type { MatchResult } from "@/lib/matching";

/** Données nécessaires à l'affichage d'une JobCard (sérialisables → utilisables côté client). */
export type JobCardData = {
  id: string;
  slug: string;
  title: string;
  city: string;
  department: string | null;
  region: string | null;
  publishedAt: string;
  contractType: ContractType;
  educationLevelMin: EducationLevel | null;
  educationLevelMax: EducationLevel | null;
  remote: RemotePolicy;
  rhythm: WorkRhythm | null;
  durationMonths: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  skills: Array<{ slug: string; name: string; required: boolean }>;
  jobFamily: string;
  sector: string;
  isDemo: boolean;
  dataOrigin: DataOrigin;
  verificationStatus: JobVerificationStatus;
  lastVerifiedAt: string | null;
  sourceLabel: string;
  sourceCount: number;
  company: { id: string; slug: string; name: string; logoUrl: string | null; size: CompanySize; sector: string; isPlaceholder: boolean };
  /** Lien de candidature officiel (site carrières, source) : utilisable sans compte. */
  applicationUrl: string | null;
  match: MatchResult | null;
  distanceKm: number | null;
  priority: number | null;
  isFavorite: boolean;
  favoriteCollection: string | null;
  applicationStatus: ApplicationStatus | null;
  applicationId: string | null;
};

export type JobSearchResult = {
  items: JobCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  interpretation?: string[];
};

/** Détail complet d'une offre (panneau latéral et page dédiée). */
export type JobDetailData = JobCardData & {
  description: string;
  missions: string[];
  requirements: string[];
  benefits: string[];
  startDate: string | null;
  expiresAt: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  applicationEmail: string | null;
  applicationLabel: string | null;
  sourceName: string;
  /** Toutes les sources qui publient cette offre (Phase 6), la principale d'abord. */
  sources: Array<{ key: string; name: string; url: string | null; applicationUrl: string | null; isPrimary: boolean; status: JobVerificationStatus; lastVerifiedAt: string | null }>;
  otherSources: Array<{ name: string; url: string | null }>;
  dataQualityScore: number | null;
  viewCount: number;
  companyDetail: {
    sizeOrigin: DataOrigin;
    description: string | null;
    website: string | null;
    careersUrl: string | null;
    headcount: number | null;
    city: string;
    hiresApprentices: boolean;
    apprenticeCountEstimate: number | null;
    contactsCount: number;
    activeJobsCount: number;
  };
  travel: { home: { minutes: number; distanceKm: number; quality: "estimated" | "routed" } | null; school: { minutes: number; distanceKm: number; quality: "estimated" | "routed" } | null };
};

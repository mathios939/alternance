import type { CompanySize, DataOrigin } from "@/generated/prisma/enums";
import type { OpportunityResult } from "@/lib/matching";
import type { CompanySourceRef } from "@/services/ingestion/data-sources";

export type CompanyCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sector: string;
  size: CompanySize;
  headcount: number | null;
  city: string;
  department: string | null;
  region: string | null;
  logoUrl: string | null;
  technologies: string[];
  jobFamilies: string[];
  hiresApprentices: boolean;
  apprenticeCountEstimate: number | null;
  isHiring: boolean;
  activeJobsCount: number;
  contactsCount: number;
  isDemo: boolean;
  dataOrigin: DataOrigin;
  /** Provenance de la taille : REAL (tranche SIRENE), ESTIMATED, UNKNOWN, DEMO. */
  sizeOrigin: DataOrigin;
  isPlaceholder: boolean;
  siren: string | null;
  employeeRangeLabel: string | null;
  dataSources: CompanySourceRef[];
  lastVerifiedAt: string | null;
  opportunity: OpportunityResult | null;
  distanceKm: number | null;
  isFavorite: boolean;
  hasApplication: boolean;
};

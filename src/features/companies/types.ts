import type { CompanySize, DataOrigin } from "@/generated/prisma/enums";
import type { OpportunityResult } from "@/lib/matching";

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
  opportunity: OpportunityResult | null;
  distanceKm: number | null;
  isFavorite: boolean;
  hasApplication: boolean;
};

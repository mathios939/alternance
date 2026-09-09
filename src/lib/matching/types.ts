import type { ContractType, EducationLevel, Mobility, RemotePolicy, WorkRhythm, CompanySize } from "@/generated/prisma/enums";

/** Vue minimale du candidat pour le calcul de compatibilité. */
export type CandidateForMatching = {
  educationLevel: EducationLevel | null;
  jobFamily: string | null;
  targetJobTitle: string | null;
  /** Slugs de compétences normalisés. */
  skills: string[];
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  department: string | null;
  region: string | null;
  maxRadiusKm: number;
  mobility: Mobility;
  hasDrivingLicense: boolean;
  hasVehicle: boolean;
  remotePreference: RemotePolicy | null;
  rhythm: WorkRhythm | null;
  durationMonths: number | null;
  startDate: Date | null;
  contractTypes: ContractType[];
  sectors: string[];
  /** Mois d'expérience cumulés (stages, jobs, projets pro). */
  experienceMonths: number;
  /** Mots-clés issus des expériences (titres, descriptions). */
  experienceKeywords: string[];
};

/** Vue minimale d'une offre pour le calcul de compatibilité. */
export type JobForMatching = {
  id: string;
  title: string;
  jobFamily: string;
  sector: string;
  /** Slugs normalisés de toutes les compétences de l'offre. */
  skills: string[];
  /** Sous-ensemble : compétences marquées comme requises. */
  requiredSkills: string[];
  educationLevelMin: EducationLevel | null;
  educationLevelMax: EducationLevel | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  department: string | null;
  region: string | null;
  remote: RemotePolicy;
  rhythm: WorkRhythm | null;
  durationMonths: number | null;
  startDate: Date | null;
  contractType: ContractType;
  publishedAt: Date;
};

export type CompanyForMatching = {
  id: string;
  sector: string;
  size: CompanySize;
  jobFamilies: string[];
  technologies: string[];
  latitude: number | null;
  longitude: number | null;
  city: string;
  department: string | null;
  region: string | null;
  hiresApprentices: boolean;
  apprenticeCountEstimate: number | null;
  isHiring: boolean;
  activeJobsCount: number;
  lastActivityAt: Date | null;
};

export type ScoreReason = { kind: "positive" | "warning" | "neutral"; label: string; detail?: string };

export type MatchBreakdown = {
  education: number;
  skills: number;
  location: number;
  experience: number;
  rhythm: number;
  mobility: number;
};

export type MatchResult = {
  total: number;
  breakdown: MatchBreakdown;
  weights: MatchBreakdown;
  reasons: ScoreReason[];
  matchedSkills: string[];
  missingSkills: string[];
  distanceKm: number | null;
  level: "excellent" | "good" | "fair" | "low";
};

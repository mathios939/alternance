/**
 * QUALITÉ DES DONNÉES (Phase 16) : score 0-100 explicable, jamais un jugement sur l'offre elle-même.
 */
export type JobQualityInput = {
  title: string;
  description: string;
  companyKnown: boolean;
  city: string | null;
  hasCoordinates: boolean;
  applicationUrl: string | null;
  sourceKnown: boolean;
  publishedAt: Date | null;
  lastVerifiedAt: Date | null;
  educationLevelKnown: boolean;
  salaryKnown: boolean;
  durationKnown: boolean;
  skillsCount: number;
};

export type JobQualityCheck = { key: string; label: string; weight: number; passed: boolean };
export type JobQualityResult = { score: number; label: "Données complètes" | "Données partielles" | "Données insuffisantes"; checks: JobQualityCheck[]; missing: string[] };

export function calculateJobDataQuality(input: JobQualityInput, now = new Date()): JobQualityResult {
  const checks: JobQualityCheck[] = [
    { key: "title", label: "Titre présent", weight: 12, passed: input.title.trim().length >= 3 },
    { key: "company", label: "Entreprise identifiée", weight: 14, passed: input.companyKnown },
    { key: "city", label: "Ville présente", weight: 10, passed: Boolean(input.city?.trim()) },
    { key: "coordinates", label: "Géolocalisation", weight: 6, passed: input.hasCoordinates },
    { key: "description", label: "Description suffisante", weight: 14, passed: input.description.trim().length >= 200 },
    { key: "url", label: "Lien de candidature valide", weight: 12, passed: Boolean(input.applicationUrl && /^https?:\/\//.test(input.applicationUrl)) },
    { key: "source", label: "Source connue", weight: 8, passed: input.sourceKnown },
    { key: "date", label: "Date de publication valide", weight: 6, passed: Boolean(input.publishedAt && !Number.isNaN(input.publishedAt.getTime()) && input.publishedAt.getTime() <= now.getTime() + 86_400_000) },
    { key: "verified", label: "Vérifiée récemment (< 7 jours)", weight: 8, passed: Boolean(input.lastVerifiedAt && now.getTime() - input.lastVerifiedAt.getTime() < 7 * 86_400_000) },
    { key: "level", label: "Niveau d'études précisé", weight: 4, passed: input.educationLevelKnown },
    { key: "salary", label: "Rémunération précisée", weight: 2, passed: input.salaryKnown },
    { key: "duration", label: "Durée précisée", weight: 2, passed: input.durationKnown },
    { key: "skills", label: "Compétences listées", weight: 2, passed: input.skillsCount > 0 },
  ];
  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const label = score >= 80 ? "Données complètes" : score >= 50 ? "Données partielles" : "Données insuffisantes";
  return { score, label, checks, missing: checks.filter((c) => !c.passed).map((c) => c.label) };
}

export function qualityLabel(score: number | null | undefined): JobQualityResult["label"] | null {
  if (score === null || score === undefined) return null;
  return score >= 80 ? "Données complètes" : score >= 50 ? "Données partielles" : "Données insuffisantes";
}

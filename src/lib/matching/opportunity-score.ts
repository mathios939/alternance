import { JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { haversineKm } from "@/lib/geo";
import { clamp } from "@/lib/utils";
import type { CandidateForMatching, CompanyForMatching, ScoreReason } from "./types";

/**
 * ─────────────────────────────────────────────────────────────
 * OPPORTUNITY SCORE — probabilité estimée qu'une entreprise soit
 * une bonne cible pour une candidature (même sans offre active).
 *
 * Facteurs (total 100) :
 *   proximité 25 · métier compatible 20 · secteur 15 ·
 *   historique d'alternants 20 · recrute actuellement 10 ·
 *   taille adaptée 10  (+ bonus activité récente, max +5)
 *
 * C'est une ESTIMATION : elle doit toujours être présentée comme telle.
 * ─────────────────────────────────────────────────────────────
 */
export type OpportunityResult = {
  score: number;
  reasons: ScoreReason[];
  distanceKm: number | null;
  isEstimate: true;
  level: "hot" | "warm" | "cool";
};

const SIZE_SCORE: Record<CompanyForMatching["size"], number> = { TPE: 55, PME: 100, ETI: 90, GE: 75 };

export function calculateOpportunityScore(candidate: CandidateForMatching, company: CompanyForMatching): OpportunityResult {
  const reasons: ScoreReason[] = [];
  let distanceKm: number | null = null;

  // Proximité (25)
  let proximity = 40;
  if (candidate.latitude !== null && candidate.longitude !== null && company.latitude !== null && company.longitude !== null) {
    distanceKm = haversineKm({ lat: candidate.latitude, lng: candidate.longitude }, { lat: company.latitude, lng: company.longitude });
    const r = Math.max(candidate.maxRadiusKm, 5);
    if (distanceKm <= r * 0.34) proximity = 100;
    else if (distanceKm <= r * 0.67) proximity = 85;
    else if (distanceKm <= r) proximity = 65;
    else if (distanceKm <= r * 1.5) proximity = 35;
    else proximity = candidate.mobility === "NATIONAL" ? 40 : 10;
    if (proximity >= 65) reasons.push({ kind: "positive", label: `À ${Math.round(distanceKm)} km de chez toi` });
    else reasons.push({ kind: "warning", label: `À ${Math.round(distanceKm)} km, au-delà de ton rayon` });
  } else if (candidate.city && candidate.city.toLowerCase() === company.city.toLowerCase()) {
    proximity = 90;
    reasons.push({ kind: "positive", label: "Dans ta ville" });
  } else if (candidate.department && company.department === candidate.department) {
    proximity = 65;
  }

  // Métier compatible (20)
  let family = 30;
  if (candidate.jobFamily) {
    if (company.jobFamilies.includes(candidate.jobFamily)) {
      family = 100;
      reasons.push({ kind: "positive", label: `Recrute des profils ${JOB_FAMILIES[candidate.jobFamily as JobFamilyKey]?.label.toLowerCase() ?? candidate.jobFamily}` });
    } else if (JOB_FAMILIES[candidate.jobFamily as JobFamilyKey]?.sectors.includes(company.sector as never)) {
      family = 60;
      reasons.push({ kind: "neutral", label: "Secteur cohérent avec ton métier" });
    } else {
      family = 20;
    }
  }
  // Technologies (bonus intégré au métier)
  const techOverlap = company.technologies.filter((t) => candidate.skills.includes(t)).length;
  if (techOverlap > 0) {
    family = Math.min(100, family + techOverlap * 10);
    reasons.push({ kind: "positive", label: `${techOverlap} technologie${techOverlap > 1 ? "s" : ""} en commun` });
  }

  // Secteur souhaité (15)
  let sector = 50;
  if (candidate.sectors.length > 0) {
    sector = candidate.sectors.includes(company.sector) ? 100 : 30;
    if (sector === 100) reasons.push({ kind: "positive", label: "Secteur que tu recherches" });
  }

  // Historique d'alternants (20)
  let apprentices = 30;
  if (company.hiresApprentices) {
    apprentices = company.apprenticeCountEstimate && company.apprenticeCountEstimate >= 5 ? 100 : 80;
    reasons.push({
      kind: "positive",
      label: company.apprenticeCountEstimate
        ? `Accueille régulièrement des alternants (~${company.apprenticeCountEstimate})`
        : "A déjà accueilli des alternants",
    });
  }

  // Recrute actuellement (10)
  let hiring = 30;
  if (company.activeJobsCount > 0) {
    hiring = 100;
    reasons.push({ kind: "positive", label: `${company.activeJobsCount} offre${company.activeJobsCount > 1 ? "s" : ""} en cours` });
  } else if (company.isHiring) {
    hiring = 75;
    reasons.push({ kind: "neutral", label: "Signale recruter, sans offre d'alternance publiée" });
  } else {
    reasons.push({ kind: "neutral", label: "Aucune offre publiée : candidature spontanée recommandée" });
  }

  // Taille (10)
  const size = SIZE_SCORE[company.size];

  let score =
    proximity * 0.25 + family * 0.2 + sector * 0.15 + apprentices * 0.2 + hiring * 0.1 + size * 0.1;

  // Bonus activité récente (max +5)
  if (company.lastActivityAt) {
    const days = (Date.now() - company.lastActivityAt.getTime()) / 86_400_000;
    if (days <= 30) score += 5;
    else if (days <= 90) score += 2;
  }

  const total = clamp(Math.round(score), 0, 100);
  const order = { positive: 0, warning: 1, neutral: 2 };
  reasons.sort((a, b) => order[a.kind] - order[b.kind]);
  return {
    score: total,
    reasons,
    distanceKm,
    isEstimate: true,
    level: total >= 75 ? "hot" : total >= 55 ? "warm" : "cool",
  };
}

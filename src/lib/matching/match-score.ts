import { educationRank } from "@/config/taxonomy";
import { haversineKm } from "@/lib/geo";
import { clamp } from "@/lib/utils";
import { tokenize } from "@/lib/text/normalize";
import { skillDisplayName } from "@/lib/skills";
import type { CandidateForMatching, JobForMatching, MatchBreakdown, MatchResult, ScoreReason } from "./types";

/**
 * ─────────────────────────────────────────────────────────────
 * MATCH SCORE — règles lisibles, documentées dans docs/SCORING.md
 *
 * Pondérations (total = 100) :
 *   formation 25 · compétences 30 · localisation 20 ·
 *   expérience 10 · rythme 5 · mobilité/télétravail 10
 *
 * Chaque sous-score est compris entre 0 et 100.
 * ─────────────────────────────────────────────────────────────
 */
export const MATCH_WEIGHTS: MatchBreakdown = {
  education: 25,
  skills: 30,
  location: 20,
  experience: 10,
  rhythm: 5,
  mobility: 10,
};

function scoreEducation(c: CandidateForMatching, j: JobForMatching, reasons: ScoreReason[]): number {
  const cand = educationRank(c.educationLevel);
  const min = educationRank(j.educationLevelMin);
  const max = educationRank(j.educationLevelMax);

  if (min === null && max === null) {
    reasons.push({ kind: "neutral", label: "Niveau d'études non précisé dans l'offre" });
    return 90;
  }
  if (cand === null) {
    reasons.push({ kind: "warning", label: "Renseigne ton niveau d'études", detail: "Il compte pour 25 % du score." });
    return 50;
  }
  const lo = min ?? max ?? cand;
  const hi = max ?? min ?? cand;
  if (cand >= lo && cand <= hi) {
    reasons.push({ kind: "positive", label: "Niveau d'études compatible" });
    return 100;
  }
  if (cand < lo) {
    const gap = lo - cand;
    reasons.push({
      kind: "warning",
      label: gap === 1 ? "Un niveau en dessous du minimum demandé" : "Niveau d'études inférieur à celui demandé",
      detail: "Mets en avant tes projets et ta motivation pour compenser.",
    });
    return gap === 1 ? 60 : gap === 2 ? 30 : 10;
  }
  const over = cand - hi;
  reasons.push({ kind: "neutral", label: "Niveau supérieur à celui demandé", detail: "Ce n'est généralement pas bloquant." });
  return over === 1 ? 80 : 65;
}

function scoreSkills(c: CandidateForMatching, j: JobForMatching, reasons: ScoreReason[]): { score: number; matched: string[]; missing: string[] } {
  const cand = new Set(c.skills);
  const jobSkills = Array.from(new Set(j.skills));
  const required = new Set(j.requiredSkills);
  const familyMatch = Boolean(c.jobFamily && c.jobFamily === j.jobFamily);

  if (jobSkills.length === 0) {
    const score = familyMatch ? 85 : c.jobFamily ? 55 : 65;
    reasons.push(
      familyMatch
        ? { kind: "positive", label: "Métier recherché aligné avec l'offre" }
        : { kind: "neutral", label: "Aucune compétence précise listée dans l'offre" },
    );
    return { score, matched: [], missing: [] };
  }

  const matched = jobSkills.filter((s) => cand.has(s));
  const missing = jobSkills.filter((s) => !cand.has(s));
  let weightTotal = 0;
  let weightMatched = 0;
  for (const s of jobSkills) {
    const w = required.has(s) || required.size === 0 ? 1 : 0.5;
    weightTotal += w;
    if (cand.has(s)) weightMatched += w;
  }
  const overlap = weightTotal === 0 ? 0 : weightMatched / weightTotal;
  // 70 % chevauchement des compétences, 30 % alignement du métier
  const score = Math.round(overlap * 70 + (familyMatch ? 30 : c.jobFamily ? 8 : 15));

  if (matched.length > 0) {
    reasons.push({
      kind: "positive",
      label: `${matched.length} compétence${matched.length > 1 ? "s" : ""} sur ${jobSkills.length}`,
      detail: matched.slice(0, 5).map(skillDisplayName).join(" · "),
    });
  } else if (cand.size === 0) {
    reasons.push({ kind: "warning", label: "Ajoute tes compétences à ton profil", detail: "Elles comptent pour 30 % du score." });
  }
  const missingRequired = missing.filter((s) => required.has(s));
  const toWarn = (missingRequired.length ? missingRequired : missing).slice(0, 3);
  if (toWarn.length > 0 && cand.size > 0) {
    reasons.push({
      kind: "warning",
      label: `${toWarn.map(skillDisplayName).join(", ")} ${toWarn.length > 1 ? "apparaissent" : "apparaît"} dans l'annonce mais pas dans ton profil`,
    });
  }
  if (familyMatch) reasons.push({ kind: "positive", label: "Métier recherché aligné avec l'offre" });
  return { score: clamp(score, 0, 100), matched, missing };
}

function scoreLocation(c: CandidateForMatching, j: JobForMatching, reasons: ScoreReason[]): { score: number; distanceKm: number | null } {
  if (j.remote === "FULL") {
    reasons.push({ kind: "positive", label: "Télétravail complet : la distance n'est pas un frein" });
    return { score: 100, distanceKm: null };
  }
  const hasCoords = c.latitude !== null && c.longitude !== null && j.latitude !== null && j.longitude !== null;
  if (hasCoords) {
    const d = haversineKm({ lat: c.latitude!, lng: c.longitude! }, { lat: j.latitude!, lng: j.longitude! });
    const r = Math.max(c.maxRadiusKm, 5);
    const rounded = Math.round(d);
    if (d <= r * 0.34) {
      reasons.push({ kind: "positive", label: `${rounded} km de chez toi` });
      return { score: 100, distanceKm: d };
    }
    if (d <= r * 0.67) {
      reasons.push({ kind: "positive", label: `${rounded} km de chez toi` });
      return { score: 85, distanceKm: d };
    }
    if (d <= r) {
      reasons.push({ kind: "neutral", label: `${rounded} km de chez toi, dans ton rayon` });
      return { score: 70, distanceKm: d };
    }
    if (d <= r * 1.5) {
      reasons.push({ kind: "warning", label: `${rounded} km : au-delà de ton rayon de ${r} km` });
      return { score: c.hasVehicle ? 50 : 40, distanceKm: d };
    }
    const sameRegion = c.region && j.region && c.region === j.region;
    if (c.mobility === "NATIONAL") {
      reasons.push({ kind: "neutral", label: `${rounded} km, mais tu es mobile partout en France` });
      return { score: 60, distanceKm: d };
    }
    if (c.mobility === "REGION" && sameRegion) {
      reasons.push({ kind: "neutral", label: `${rounded} km, dans ta région de mobilité` });
      return { score: 60, distanceKm: d };
    }
    reasons.push({ kind: "warning", label: `${rounded} km : trop loin selon tes critères de mobilité` });
    return { score: 15, distanceKm: d };
  }
  // Sans coordonnées : raisonnement par zones
  if (c.city && c.city.toLowerCase() === j.city.toLowerCase()) {
    reasons.push({ kind: "positive", label: "Même ville que toi" });
    return { score: 90, distanceKm: null };
  }
  if (c.department && j.department && c.department === j.department) {
    reasons.push({ kind: "positive", label: "Dans ton département" });
    return { score: 70, distanceKm: null };
  }
  if (c.region && j.region && c.region === j.region) {
    reasons.push({ kind: "neutral", label: "Dans ta région" });
    return { score: c.mobility === "REGION" || c.mobility === "NATIONAL" ? 65 : 45, distanceKm: null };
  }
  if (c.mobility === "NATIONAL") return { score: 55, distanceKm: null };
  reasons.push({ kind: "warning", label: "Localisation éloignée de ta zone de recherche" });
  return { score: 20, distanceKm: null };
}

function scoreExperience(c: CandidateForMatching, j: JobForMatching, reasons: ScoreReason[]): number {
  const m = c.experienceMonths;
  let base = m >= 12 ? 100 : m >= 6 ? 85 : m >= 1 ? 70 : 55;
  const jobTokens = new Set(tokenize(j.title));
  const overlap = c.experienceKeywords.filter((k) => jobTokens.has(k)).length;
  if (overlap > 0) {
    base = Math.min(100, base + overlap * 8);
    reasons.push({ kind: "positive", label: "Une expérience en lien direct avec le poste" });
  } else if (m === 0) {
    reasons.push({ kind: "neutral", label: "Pas encore d'expérience : mise sur tes projets", detail: "En alternance, la motivation et les projets comptent autant." });
  }
  return base;
}

function scoreRhythm(c: CandidateForMatching, j: JobForMatching, reasons: ScoreReason[]): number {
  let rhythm: number;
  if (!j.rhythm) rhythm = 80;
  else if (!c.rhythm) rhythm = 75;
  else if (c.rhythm === j.rhythm) {
    rhythm = 100;
    reasons.push({ kind: "positive", label: "Rythme école / entreprise compatible" });
  } else {
    rhythm = 45;
    reasons.push({ kind: "warning", label: "Le rythme demandé diffère du tien", detail: "Vérifie avec ton école si c'est négociable." });
  }
  let duration = 80;
  if (c.durationMonths && j.durationMonths) {
    const diff = Math.abs(c.durationMonths - j.durationMonths);
    duration = diff === 0 ? 100 : diff <= 6 ? 75 : 50;
    if (diff > 6) reasons.push({ kind: "warning", label: `Durée de ${j.durationMonths} mois, tu cherches ${c.durationMonths} mois` });
  }
  return Math.round(rhythm * 0.7 + duration * 0.3);
}

function scoreMobility(c: CandidateForMatching, j: JobForMatching, distanceKm: number | null, reasons: ScoreReason[]): number {
  let score = 100;
  if (c.remotePreference === "FULL" && j.remote === "NONE") {
    score -= 45;
    reasons.push({ kind: "warning", label: "Tu souhaites du télétravail, l'offre est 100 % sur site" });
  } else if (c.remotePreference === "HYBRID" && j.remote === "NONE") {
    score -= 20;
  } else if (j.remote === "HYBRID" && c.remotePreference !== "NONE") {
    reasons.push({ kind: "positive", label: "Hybride : télétravail possible" });
  }
  if (distanceKm !== null && distanceKm > 15 && !c.hasVehicle && j.remote === "NONE") {
    score -= 20;
    reasons.push({ kind: "warning", label: "Sans véhicule, vérifie les transports en commun", detail: `${Math.round(distanceKm)} km sur site.` });
  }
  if (c.contractTypes.length > 0 && !c.contractTypes.includes(j.contractType)) {
    score -= 15;
    reasons.push({ kind: "neutral", label: "Type de contrat différent de ta préférence" });
  }
  return clamp(score, 0, 100);
}

export function matchLevel(total: number): MatchResult["level"] {
  if (total >= 85) return "excellent";
  if (total >= 70) return "good";
  if (total >= 50) return "fair";
  return "low";
}

/**
 * Calcule la compatibilité entre un candidat et une offre.
 * Toutes les règles sont explicables ; aucune donnée n'est inventée.
 */
export function calculateMatchScore(candidate: CandidateForMatching, job: JobForMatching): MatchResult {
  const reasons: ScoreReason[] = [];
  const education = scoreEducation(candidate, job, reasons);
  const skills = scoreSkills(candidate, job, reasons);
  const location = scoreLocation(candidate, job, reasons);
  const experience = scoreExperience(candidate, job, reasons);
  const rhythm = scoreRhythm(candidate, job, reasons);
  const mobility = scoreMobility(candidate, job, location.distanceKm, reasons);

  const breakdown: MatchBreakdown = {
    education,
    skills: skills.score,
    location: location.score,
    experience,
    rhythm,
    mobility,
  };
  const total = Math.round(
    (Object.keys(MATCH_WEIGHTS) as (keyof MatchBreakdown)[]).reduce(
      (sum, key) => sum + (breakdown[key] * MATCH_WEIGHTS[key]) / 100,
      0,
    ),
  );

  // Ordonner : positifs d'abord, puis avertissements, puis neutres
  const order = { positive: 0, warning: 1, neutral: 2 };
  reasons.sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    total: clamp(total, 0, 100),
    breakdown,
    weights: MATCH_WEIGHTS,
    reasons,
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
    distanceKm: location.distanceKm,
    level: matchLevel(total),
  };
}

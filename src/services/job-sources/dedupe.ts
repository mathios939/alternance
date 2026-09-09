import { normalizeCompanyName, normalizeText } from "@/lib/text/normalize";
import { diceSimilarity, textSimilarity, titleSimilarity } from "@/lib/text/similarity";
import { normalizeJobTitle, UNKNOWN_EMPLOYER_NAME } from "./normalize";

/**
 * ─────────────────────────────────────────────────────────────
 * DÉDOUBLONNAGE (Phase 5) — même poste publié sur plusieurs sources.
 *
 * Signaux, du plus sûr au plus faible :
 *   identifiant externe (même source) · URL canonique · entreprise ·
 *   titre normalisé · ville / code postal · similarité de description ·
 *   écart de dates de publication.
 *
 * Résultat : confiance de 0 à 1, avec des seuils explicites.
 *   ≥ 0.92 → doublon automatique (rattaché à l'offre canonique)
 *   0.75 – 0.92 → doublon probable (créé mais masqué, à vérifier en admin)
 *   < 0.75 → offres distinctes
 * ─────────────────────────────────────────────────────────────
 */
export type DedupeCandidate = {
  id: string;
  title: string;
  normalizedTitle?: string | null;
  companyName: string;
  city: string;
  postalCode?: string | null;
  description: string;
  sourceUrl: string | null;
  applicationUrl?: string | null;
  publishedAt: Date;
  sourceKey?: string | null;
  externalId?: string | null;
};

export type DuplicateLevel = "duplicate" | "probable" | "distinct";

export type DuplicateVerdict = {
  /** 0 à 1 */
  confidence: number;
  level: DuplicateLevel;
  isDuplicate: boolean;
  signals: string[];
};

export const DUPLICATE_THRESHOLDS = { duplicate: 0.92, probable: 0.75 } as const;

const TRACKING_PARAMS = /^(utm_|ref$|source$|fbclid$|gclid$|mc_|_hs)/i;

/** URL canonique : sans protocole, www, ancre ni paramètres de suivi. */
export function canonicalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase() || null;
  }
}

export function duplicateLevel(confidence: number): DuplicateLevel {
  if (confidence >= DUPLICATE_THRESHOLDS.duplicate) return "duplicate";
  if (confidence >= DUPLICATE_THRESHOLDS.probable) return "probable";
  return "distinct";
}

function isUnknownEmployer(name: string): boolean {
  const n = normalizeText(name);
  return !n || n === normalizeText(UNKNOWN_EMPLOYER_NAME) || /confidentiel|non communiqu|anonyme/.test(n);
}

/**
 * Confiance (0-1) que deux offres décrivent la même publication.
 * Déterministe et explicable : chaque signal retenu est listé.
 */
export function calculateDuplicateConfidence(a: DedupeCandidate, b: DedupeCandidate): DuplicateVerdict {
  const signals: string[] = [];

  if (a.sourceKey && a.externalId && a.sourceKey === b.sourceKey && a.externalId === b.externalId) {
    return { confidence: 1, level: "duplicate", isDuplicate: true, signals: ["Même identifiant dans la même source"] };
  }
  const urlsA = [canonicalUrl(a.sourceUrl), canonicalUrl(a.applicationUrl)].filter(Boolean);
  const urlsB = [canonicalUrl(b.sourceUrl), canonicalUrl(b.applicationUrl)].filter(Boolean);
  if (urlsA.some((u) => urlsB.includes(u))) {
    return { confidence: 0.98, level: "duplicate", isDuplicate: true, signals: ["URL identique"] };
  }

  const compA = normalizeCompanyName(a.companyName);
  const compB = normalizeCompanyName(b.companyName);
  const unknownCompany = isUnknownEmployer(a.companyName) || isUnknownEmployer(b.companyName);
  let score = 0;

  // Entreprise (0.30)
  let companyKnownAndDifferent = false;
  if (unknownCompany) {
    score += 0.1;
  } else if (compA === compB) {
    score += 0.3;
    signals.push("Même entreprise");
  } else if (compA.includes(compB) || compB.includes(compA) || diceSimilarity(compA, compB) >= 0.85) {
    score += 0.2;
    signals.push("Entreprise très proche");
  } else {
    companyKnownAndDifferent = true;
  }

  // Titre (0.28)
  const titleA = a.normalizedTitle ?? normalizeJobTitle(a.title);
  const titleB = b.normalizedTitle ?? normalizeJobTitle(b.title);
  const title = titleA === titleB ? 1 : Math.max(titleSimilarity(a.title, b.title), diceSimilarity(titleA, titleB));
  if (title >= 0.95) {
    score += 0.28;
    signals.push("Titre identique");
  } else if (title >= 0.8) {
    score += 0.2;
    signals.push("Titre très proche");
  } else if (title >= 0.6) {
    score += 0.1;
  }

  // Lieu (0.15)
  const sameCity = normalizeText(a.city) === normalizeText(b.city) && Boolean(normalizeText(a.city));
  const samePostal = Boolean(a.postalCode && b.postalCode && a.postalCode === b.postalCode);
  if (sameCity || samePostal) {
    score += samePostal ? 0.15 : 0.12;
    signals.push(samePostal ? "Même code postal" : "Même ville");
  }

  // Description (0.20)
  const text = textSimilarity(a.description, b.description);
  if (text >= 0.7) {
    score += 0.2;
    signals.push("Description quasi identique");
  } else if (text >= 0.45) {
    score += 0.12;
    signals.push("Description similaire");
  } else if (text >= 0.25) {
    score += 0.05;
  }

  // Dates (± 0.07)
  const daysApart = Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 86_400_000;
  if (daysApart <= 3) score += 0.07;
  else if (daysApart <= 14) score += 0.04;
  else if (daysApart > 60) score -= 0.15;

  if (companyKnownAndDifferent) score = Math.min(score, 0.6);
  if (unknownCompany) score = Math.min(score, 0.9);

  const confidence = Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
  const level = duplicateLevel(confidence);
  return { confidence, level, isDuplicate: level === "duplicate", signals };
}

/**
 * Trouve, parmi des offres existantes, la meilleure correspondance d'une nouvelle offre.
 * Retourne la meilleure au-dessus du seuil « probable », sinon null.
 */
export function findCanonical(candidate: DedupeCandidate, existing: DedupeCandidate[]): { match: DedupeCandidate; verdict: DuplicateVerdict } | null {
  let best: { match: DedupeCandidate; verdict: DuplicateVerdict } | null = null;
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    const verdict = calculateDuplicateConfidence(candidate, other);
    if (verdict.level !== "distinct" && (!best || verdict.confidence > best.verdict.confidence)) best = { match: other, verdict };
  }
  return best;
}

/** Compatibilité : score 0-100 et seuil historique. */
export const DUPLICATE_THRESHOLD = Math.round(DUPLICATE_THRESHOLDS.duplicate * 100);
export function duplicateConfidenceScore(a: DedupeCandidate, b: DedupeCandidate): { confidence: number; isDuplicate: boolean; signals: string[] } {
  const v = calculateDuplicateConfidence(a, b);
  return { confidence: Math.round(v.confidence * 100), isDuplicate: v.isDuplicate, signals: v.signals };
}

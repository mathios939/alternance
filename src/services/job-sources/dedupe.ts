import { normalizeCompanyName, normalizeText } from "@/lib/text/normalize";
import { textSimilarity, titleSimilarity } from "@/lib/text/similarity";

export type DedupeCandidate = {
  id: string;
  title: string;
  companyName: string;
  city: string;
  description: string;
  sourceUrl: string | null;
  publishedAt: Date;
};

export type DuplicateVerdict = {
  confidence: number; // 0-100
  isDuplicate: boolean;
  signals: string[];
};

export const DUPLICATE_THRESHOLD = 78;

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_|^ref$|^source$|^fbclid$|^gclid$/i.test(key)) u.searchParams.delete(key);
    }
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Score de confiance qu'il s'agisse de la même offre publiée deux fois.
 * Signaux : entreprise, titre, ville, similarité du texte, URL, écart de dates.
 */
export function duplicateConfidenceScore(a: DedupeCandidate, b: DedupeCandidate): DuplicateVerdict {
  const signals: string[] = [];

  const urlA = normalizeUrl(a.sourceUrl);
  const urlB = normalizeUrl(b.sourceUrl);
  if (urlA && urlB && urlA === urlB) {
    return { confidence: 100, isDuplicate: true, signals: ["URL identique"] };
  }

  const sameCompany = normalizeCompanyName(a.companyName) === normalizeCompanyName(b.companyName);
  const sameCity = normalizeText(a.city) === normalizeText(b.city);
  const title = titleSimilarity(a.title, b.title);
  const text = textSimilarity(a.description, b.description);
  const daysApart = Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 86_400_000;

  let score = 0;
  if (sameCompany) {
    score += 30;
    signals.push("Même entreprise");
  }
  if (sameCity) {
    score += 12;
    signals.push("Même ville");
  }
  if (title >= 0.9) {
    score += 30;
    signals.push("Titre identique");
  } else if (title >= 0.7) {
    score += 20;
    signals.push("Titre très proche");
  } else if (title >= 0.5) {
    score += 8;
  }
  if (text >= 0.6) {
    score += 22;
    signals.push("Description quasi identique");
  } else if (text >= 0.35) {
    score += 12;
    signals.push("Description similaire");
  } else if (text >= 0.2) {
    score += 5;
  }
  if (daysApart <= 3) score += 6;
  else if (daysApart <= 14) score += 3;
  else if (daysApart > 60) score -= 15;

  if (!sameCompany) score = Math.min(score, 55);

  const confidence = Math.max(0, Math.min(100, Math.round(score)));
  return { confidence, isDuplicate: confidence >= DUPLICATE_THRESHOLD, signals };
}

/**
 * Trouve, parmi des offres existantes, la version canonique d'une nouvelle offre.
 * Retourne la meilleure correspondance au-dessus du seuil, sinon null.
 */
export function findCanonical(candidate: DedupeCandidate, existing: DedupeCandidate[]): { match: DedupeCandidate; verdict: DuplicateVerdict } | null {
  let best: { match: DedupeCandidate; verdict: DuplicateVerdict } | null = null;
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    const verdict = duplicateConfidenceScore(candidate, other);
    if (verdict.isDuplicate && (!best || verdict.confidence > best.verdict.confidence)) best = { match: other, verdict };
  }
  return best;
}

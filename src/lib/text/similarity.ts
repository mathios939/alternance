import { normalizeText, tokenize } from "@/lib/text/normalize";

/** Similarité de Jaccard sur des ensembles de tokens (0-1). */
export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function bigrams(input: string): Map<string, number> {
  const s = normalizeText(input).replace(/\s+/g, " ");
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

/** Coefficient de Sørensen–Dice sur bigrammes de caractères (0-1). Tolérant aux fautes. */
export function diceSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let inter = 0;
  for (const [bg, count] of ba) inter += Math.min(count, bb.get(bg) ?? 0);
  const total = [...ba.values()].reduce((s, n) => s + n, 0) + [...bb.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * inter) / total;
}

/** Similarité de titres : moyenne de Dice (caractères) et Jaccard (tokens). */
export function titleSimilarity(a: string, b: string): number {
  return 0.55 * diceSimilarity(a, b) + 0.45 * jaccard(tokenize(a), tokenize(b));
}

/** Similarité de textes longs : Jaccard sur tokens significatifs. */
export function textSimilarity(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}

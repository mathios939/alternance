/**
 * Une URL externe n'est rendue comme lien (candidature, site carrières, annonce d'origine)
 * que si elle est absolue en http(s). Tout autre schéma (javascript:, data:, mailto: déguisé…)
 * ou texte mal formé est traité comme absent : la donnée vient de sources tierces.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou", "en", "à", "a", "au", "aux", "pour", "par",
  "sur", "dans", "avec", "sans", "vous", "nous", "votre", "notre", "vos", "nos", "est", "sont", "ce", "cette", "ces",
  "qui", "que", "dont", "h", "f", "hf", "x", "alternance", "alternant", "alternante", "apprenti", "apprentie", "apprentissage",
  "contrat", "stage", "the", "and", "of", "to", "in", "for", "on", "with", "as", "an", "or", "cdi", "cdd", "poste", "offre",
  "recherche", "recherchons", "mission", "missions", "profil", "the", "you", "your", "our",
]);

export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeText(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string, { removeStopwords = true } = {}): string[] {
  const tokens = normalizeText(input)
    .split(/[\s/,;:()\[\]"«»-]+/)
    .map((t) => t.replace(/^[.+#]+|[.+#]+$/g, ""))
    .filter((t) => t.length > 1);
  return removeStopwords ? tokens.filter((t) => !STOPWORDS.has(t)) : tokens;
}

/** Normalise un nom d'entreprise (suppression des formes juridiques et de la ponctuation). */
export function normalizeCompanyName(name: string): string {
  return normalizeText(name)
    .replace(/\b(sas|sa|sarl|sasu|eurl|groupe|group|france|sca|snc|inc|ltd|gmbh|s\.a\.s|s\.a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

import { normalizeText } from "@/lib/text/normalize";

/** Détection d'une personne dans le libellé « contact » publié par une offre (module pur, sans base de données). */
const ORG_WORDS = /\b(sas|sarl|sasu|eurl|sa|snc|scop|groupe|group|association|cabinet|agence|service|direction|recrutement|rh|ressources humaines|drh|societe|société|entreprise|ets|etablissement|établissement|centre|mairie|commune|communaute|communauté|hopital|hôpital|clinique|ecole|école|lycee|lycée|universite|université|cfa|france travail|pole emploi|pôle emploi|interim|intérim|conseil|consulting|solutions|industrie|industries|technologies|logistique|transport|distribution|commerce|batiment|bâtiment|energie|énergie|automobile|assurances?|banque|mutuelle|federation|fédération|syndicat|fondation|institut|laboratoire|pharmacie|boulangerie|restaurant|hotel|hôtel|garage|magasin|supermarche|supermarché|hypermarche|hypermarché|leclerc|carrefour|intermarche|intermarché|auchan|lidl|aldi)\b/i;
const CIVILITY_RE = /^(m\.?|mr\.?|mme\.?|mlle\.?|monsieur|madame|mademoiselle)\s+/i;

export type ParsedPerson = { displayName: string; firstName: string; lastName: string; jobTitle: string | null };

/**
 * « Mme DUPONT Marie - Responsable RH » → { displayName, firstName: Marie, lastName: DUPONT, jobTitle: Responsable RH }.
 * Retourne null si le libellé ressemble à une organisation ou est ambigu.
 */
export function parsePersonLabel(label: string | null | undefined, companyName: string | null): ParsedPerson | null {
  if (!label) return null;
  const raw = label.replace(/\s+/g, " ").trim();
  if (raw.length < 5 || raw.length > 120) return null;
  const [namePartRaw, ...rest] = raw.split(/\s+[-–|,]\s+/);
  const namePart = (namePartRaw ?? "").trim();
  const jobTitle = rest.join(" - ").trim() || null;
  if (companyName && normalizeText(namePart) === normalizeText(companyName)) return null;
  const hasCivility = CIVILITY_RE.test(namePart);
  const body = namePart.replace(CIVILITY_RE, "").trim();
  if (!body || ORG_WORDS.test(body) || /\d|@|http/.test(body)) return null;
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return hasCivility && words.length === 1 ? { displayName: raw, firstName: "", lastName: body, jobTitle } : null;
  if (!hasCivility && !words.every((w) => /^[A-Za-zÀ-ÿ'’-]+$/.test(w))) return null;
  // Convention France Travail fréquente : NOM Prénom (nom en capitales)
  const upper = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  let firstName: string;
  let lastName: string;
  if (upper.length > 0 && upper.length < words.length) {
    lastName = upper.join(" ");
    firstName = words.filter((w) => !upper.includes(w)).join(" ");
  } else {
    firstName = words[0]!;
    lastName = words.slice(1).join(" ");
  }
  return { displayName: raw, firstName, lastName, jobTitle };
}


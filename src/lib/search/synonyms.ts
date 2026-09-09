import { normalizeText } from "@/lib/text/normalize";

/**
 * Synonymes métier simples (Phase 17) : « dev », « developer », « développeur », « developpeur »…
 * Chaque groupe est étendu en OR dans la requête plein texte ; les accents sont déjà
 * neutralisés par la configuration PostgreSQL `french_unaccent`.
 */
const GROUPS: string[][] = [
  ["developpeur", "developpeuse", "developer", "dev", "programmeur", "ingenieur logiciel", "software engineer"],
  ["fullstack", "full stack", "full-stack"],
  ["frontend", "front end", "front-end", "front"],
  ["backend", "back end", "back-end", "back"],
  ["data analyst", "analyste data", "analyste donnees", "data"],
  ["cybersecurite", "cyber securite", "securite informatique", "cyber", "security"],
  ["administrateur systeme", "sysadmin", "admin sys", "administrateur reseau", "infra", "devops"],
  ["chef de projet", "cheffe de projet", "project manager", "pmo"],
  ["ux", "ui", "designer", "design"],
  ["commercial", "commerciale", "business developer", "sales", "vente", "vendeur", "vendeuse"],
  ["marketing", "marketing digital", "digital marketing", "growth"],
  ["communication", "chargee de communication", "charge de communication", "com"],
  ["comptable", "comptabilite", "assistant comptable", "compta"],
  ["ressources humaines", "rh", "recrutement", "talent acquisition"],
  ["logistique", "supply chain", "approvisionnement"],
  ["assistant", "assistante", "assistant de direction", "assistante de direction", "assistant administratif"],
  ["technicien", "technicienne", "tech"],
  ["ingenieur", "ingenieure", "engineer"],
];

const INDEX = new Map<string, string[]>();
for (const group of GROUPS) for (const term of group) INDEX.set(term, group);

/** Variantes d'un terme normalisé (lui-même inclus, sans doublons). */
export function synonymsOf(term: string): string[] {
  const t = normalizeText(term);
  const group = INDEX.get(t);
  return group ? Array.from(new Set([t, ...group])) : [t];
}

function toLexeme(term: string): string {
  return term.replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean).join(" & ");
}

/**
 * Construit une requête `to_tsquery` : chaque mot de la requête devient un groupe OR de ses synonymes
 * (préfixes autorisés), les groupes étant combinés en AND. Retourne null si rien d'exploitable.
 * Ex. « developpeur nantes » → (developpeur:* | developpeuse:* | developer:* | dev:* | …) & (nantes:*)
 */
export function buildTsQuery(query: string, { prefix = true, requireAll = true }: { prefix?: boolean; requireAll?: boolean } = {}): string | null {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  // Expressions multi-mots connues d'abord (« full stack », « chef de projet »)
  const groups: string[] = [];
  let rest = normalized;
  for (const group of GROUPS) {
    for (const phrase of group) {
      if (phrase.includes(" ") && rest.includes(phrase)) {
        rest = rest.replace(phrase, " ");
        groups.push(group.map((g) => toLexeme(g)).map((l) => (prefix ? l.replace(/(\w)$/, "$1:*") : l)).map((l) => (l.includes("&") ? `(${l})` : l)).join(" | "));
      }
    }
  }
  const words = rest.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w.length > 1);
  for (const word of words) {
    const variants = synonymsOf(word).map((v) => toLexeme(v)).filter(Boolean);
    const lexemes = variants.map((l) => (prefix ? l.replace(/(\w)$/, "$1:*") : l)).map((l) => (l.includes("&") ? `(${l})` : l));
    groups.push(Array.from(new Set(lexemes)).join(" | "));
  }
  if (groups.length === 0) return null;
  return groups.map((g) => (g.includes("|") ? `(${g})` : g)).join(requireAll ? " & " : " | ");
}

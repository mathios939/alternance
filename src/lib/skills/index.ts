import { SKILL_CATALOG, type SkillDefinition } from "@/config/skills";
import { normalizeText } from "@/lib/text/normalize";
import { slugify } from "@/lib/utils";

export type SkillMatch = { name: string; slug: string; category: SkillDefinition["category"]; matchedOn: string };

type IndexEntry = { def: SkillDefinition; slug: string; pattern: RegExp; alias: string };

let index: IndexEntry[] | null = null;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildIndex(): IndexEntry[] {
  if (index) return index;
  index = [];
  for (const def of SKILL_CATALOG) {
    const slug = slugify(def.name);
    const aliases = [def.name, ...(def.aliases ?? [])].map((a) => normalizeText(a)).filter(Boolean);
    for (const alias of aliases) {
      // Mots courts (c, r, go, ia…) : exiger des délimiteurs stricts.
      const boundary = alias.length <= 2 ? "(?<![a-z0-9+#])" : "(?<![a-z0-9])";
      const end = alias.length <= 2 ? "(?![a-z0-9+#])" : "(?![a-z0-9])";
      index.push({ def, slug, alias, pattern: new RegExp(`${boundary}${escapeRegExp(alias)}${end}`, "i") });
    }
  }
  // Les alias les plus longs d'abord pour éviter les faux positifs
  index.sort((a, b) => b.alias.length - a.alias.length);
  return index;
}

/** Normalise un intitulé de compétence vers son slug canonique (ou un slug libre si inconnu). */
export function normalizeSkillName(input: string): { name: string; slug: string; known: boolean } {
  const q = normalizeText(input);
  for (const entry of buildIndex()) {
    if (entry.alias === q) return { name: entry.def.name, slug: entry.slug, known: true };
  }
  const cleaned = input.trim();
  return { name: cleaned, slug: slugify(cleaned), known: false };
}

/** Extrait les compétences connues d'un texte libre (annonce, CV…). */
export function extractSkills(text: string, options?: { includeSoft?: boolean; includeLanguages?: boolean }): SkillMatch[] {
  const normalized = normalizeText(text);
  const found = new Map<string, SkillMatch>();
  for (const entry of buildIndex()) {
    if (found.has(entry.slug)) continue;
    if (!options?.includeSoft && entry.def.category === "SOFT") continue;
    if (options?.includeLanguages === false && entry.def.category === "LANGUAGE") continue;
    if (entry.pattern.test(normalized)) {
      found.set(entry.slug, { name: entry.def.name, slug: entry.slug, category: entry.def.category, matchedOn: entry.alias });
    }
  }
  return [...found.values()];
}

export function skillSlugs(names: string[]): string[] {
  return Array.from(new Set(names.map((n) => normalizeSkillName(n).slug)));
}

export function skillDisplayName(slug: string): string {
  const def = SKILL_CATALOG.find((s) => slugify(s.name) === slug);
  return def?.name ?? slug.replace(/-/g, " ");
}

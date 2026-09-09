import { extractSkills, type SkillMatch } from "@/lib/skills";
import { countWords } from "@/lib/text/normalize";

export type ParsedResume = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  skills: SkillMatch[];
  languages: SkillMatch[];
  educationLines: string[];
  experienceLines: string[];
  sections: Record<string, string>;
  wordCount: number;
  detectedLevel: string | null;
  detectedDegree: string | null;
};

const SECTION_HEADERS: Array<[string, RegExp]> = [
  ["experience", /^(exp[eé]riences?( professionnelles?)?|parcours professionnel|emplois?|stages?)\b/i],
  ["education", /^(formations?|[eé]tudes|dipl[oô]mes?|parcours (scolaire|acad[eé]mique)|cursus)\b/i],
  ["skills", /^(comp[eé]tences?( techniques| cl[eé]s)?|skills|technologies|outils|savoir[- ]faire)\b/i],
  ["languages", /^(langues?|languages?)\b/i],
  ["projects", /^(projets?( personnels| acad[eé]miques)?|r[eé]alisations?|portfolio)\b/i],
  ["interests", /^(centres? d ?['’]?int[eé]r[eê]ts?|loisirs|hobbies|int[eé]r[eê]ts)\b/i],
  ["profile", /^(profil|[aà] propos|r[eé]sum[eé]|objectifs?|summary|about)\b/i],
];

const DEGREE_PATTERNS: Array<[RegExp, string, string]> = [
  [/\b(master|m2|ing[eé]nieur|mba)\b/i, "BAC5", "Master / Ingénieur"],
  [/\b(m1|ma[iî]trise)\b/i, "BAC4", "Master 1"],
  [/\b(licence|bachelor|\bbut\b)/i, "BAC3", "Licence / Bachelor / BUT"],
  [/\b(bts|dut)\b/i, "BAC2", "BTS / DUT"],
  [/\b(bac(calaur[eé]at)?)\b/i, "BAC", "Baccalauréat"],
];

export function splitSections(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const sections: Record<string, string[]> = { header: [] };
  let current = "header";
  for (const line of lines) {
    if (!line) continue;
    const clean = line.replace(/[:\-–•|]+$/g, "").trim();
    const header = clean.length <= 40 ? SECTION_HEADERS.find(([, re]) => re.test(clean)) : undefined;
    if (header) {
      current = header[0];
      sections[current] ??= [];
      continue;
    }
    (sections[current] ??= []).push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join("\n")]));
}

/** Extraction structurée (sans IA) d'un CV texte. Ne devine jamais au-delà du texte. */
export function parseResumeText(text: string): ParsedResume {
  const sections = splitSections(text);
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? null;
  const phone = text.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/)?.[0]?.replace(/\s+/g, " ") ?? null;
  const linkedinUrl = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9-_%]+/i)?.[0] ?? null;

  // Nom : première ligne courte en tête de document contenant 2-3 mots capitalisés
  const headerLines = (sections["header"] ?? "").split("\n").slice(0, 6);
  let firstName: string | null = null;
  let lastName: string | null = null;
  for (const line of headerLines) {
    const m = line.match(/^([A-ZÀ-Ý][a-zà-ÿ'-]+(?:-[A-ZÀ-Ý][a-zà-ÿ'-]+)?)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+(?:\s[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+)?)$/);
    if (m && !/@|\d/.test(line)) {
      firstName = m[1] ?? null;
      lastName = m[2] ?? null;
      break;
    }
  }

  const cityMatch = text.match(/\b(\d{5})\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ' -]{2,30})/);
  const city = cityMatch?.[2]?.trim() ?? null;

  const all = extractSkills(text, { includeSoft: true, includeLanguages: true });
  const skills = all.filter((s) => s.category !== "LANGUAGE");
  const languages = all.filter((s) => s.category === "LANGUAGE");

  let detectedLevel: string | null = null;
  let detectedDegree: string | null = null;
  const eduText = sections["education"] ?? text;
  for (const [re, level, label] of DEGREE_PATTERNS) {
    if (re.test(eduText)) {
      detectedLevel = level;
      detectedDegree = label;
      break;
    }
  }

  return {
    email,
    phone,
    linkedinUrl,
    firstName,
    lastName,
    city,
    skills,
    languages,
    educationLines: (sections["education"] ?? "").split("\n").filter(Boolean).slice(0, 8),
    experienceLines: (sections["experience"] ?? "").split("\n").filter(Boolean).slice(0, 12),
    sections,
    wordCount: countWords(text),
    detectedLevel,
    detectedDegree,
  };
}

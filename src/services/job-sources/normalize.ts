import type { ContractType, EducationLevel, RemotePolicy, WorkRhythm } from "@/generated/prisma/enums";
import { findCity } from "@/config/cities";
import { departmentCodeFromPostal, findDepartmentByCode } from "@/config/departments";
import { guessJobFamily, JOB_FAMILIES, type JobFamilyKey } from "@/config/taxonomy";
import { extractSkills, skillSlugs } from "@/lib/skills";
import { normalizeCompanyName, normalizeText } from "@/lib/text/normalize";
import { slugify } from "@/lib/utils";
import type { NormalizedJob, RawJob } from "./types";

/** Nom affiché quand la source ne communique pas l'employeur. Jamais présenté comme une entreprise réelle. */
export const UNKNOWN_EMPLOYER_NAME = "Employeur non communiqué";

const LEVEL_PATTERNS: Array<[RegExp, EducationLevel]> = [
  [/bac ?\+ ?5|master|ingénieur|ingenieur|m2|grande école|grande ecole|mba/i, "BAC5"],
  [/bac ?\+ ?4|m1|maîtrise|maitrise/i, "BAC4"],
  [/bac ?\+ ?3|licence|bachelor|but\b/i, "BAC3"],
  [/bac ?\+ ?2|bts|dut|deust/i, "BAC2"],
  [/bac ?\+ ?1/i, "BAC1"],
  [/\bbac\b|baccalauréat|baccalaureat|bac pro/i, "BAC"],
  [/\bcap\b|\bbep\b/i, "CAP"],
];

const LEVEL_ORDER: EducationLevel[] = ["CAP", "BAC", "BAC1", "BAC2", "BAC3", "BAC4", "BAC5"];

/** Devine la fourchette de niveau à partir du texte de l'annonce. */
export function inferEducationRange(text: string): { min: EducationLevel | null; max: EducationLevel | null } {
  const found = new Set<EducationLevel>();
  for (const [re, level] of LEVEL_PATTERNS) if (re.test(text)) found.add(level);
  if (found.size === 0) return { min: null, max: null };
  const sorted = LEVEL_ORDER.filter((l) => found.has(l));
  return { min: sorted[0] ?? null, max: sorted[sorted.length - 1] ?? null };
}

/** Télétravail déduit du texte ; « UNKNOWN » quand l'annonce n'en parle pas (jamais « sur site » par défaut). */
export function inferRemote(text: string): RemotePolicy {
  const t = normalizeText(text);
  if (/full remote|100 ?% teletravail|teletravail complet|totalement a distance/.test(t)) return "FULL";
  if (/teletravail|hybride|remote|distanciel/.test(t)) return "HYBRID";
  if (/sur site|presentiel|100 ?% presentiel|pas de teletravail|sans teletravail/.test(t)) return "NONE";
  return "UNKNOWN";
}

export function inferRhythm(text: string): WorkRhythm | null {
  const t = normalizeText(text);
  if (/2 ?j(ours)? .{0,15}3 ?j(ours)?/.test(t)) return "TWO_THREE";
  if (/3 ?j(ours)? .{0,15}2 ?j(ours)?/.test(t)) return "THREE_TWO";
  if (/1 semaine .{0,20}1 semaine|une semaine sur deux/.test(t)) return "ONE_ONE_WEEK";
  if (/1 semaine .{0,20}3 semaines/.test(t)) return "ONE_THREE_WEEK";
  if (/2 semaines .{0,20}2 semaines/.test(t)) return "TWO_TWO_WEEK";
  return null;
}

export function inferContractType(text: string): ContractType {
  const t = normalizeText(text);
  return /professionnalisation|contrat pro\b/.test(t) ? "PROFESSIONNALISATION" : "APPRENTISSAGE";
}

export function inferDuration(text: string): number | null {
  const m = normalizeText(text).match(/(\d{1,2}) ?(mois|ans?)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2]?.startsWith("an")) return n * 12;
  return [6, 12, 24, 36].includes(n) ? n : n >= 6 && n <= 36 ? n : null;
}

/** Titre normalisé : minuscules, sans accents, sans mentions H/F ni « alternance ». */
export function normalizeJobTitle(title: string): string {
  return normalizeText(title)
    .replace(/\b(h ?\/ ?f|f ?\/ ?h|h\/f\/x|f\/h\/x|hf|fh|x)\b/g, " ")
    .replace(/\b(en )?(alternance|apprentissage|apprenti\w*|alternant\w*|contrat pro\w*)\b/g, " ")
    .replace(/[()[\]\-–—/|:,;.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Transforme une offre brute (quelle que soit sa source) vers le format interne.
 * Aucun champ n'est inventé : les valeurs manquantes restent nulles. Les seules
 * inférences (niveau, rythme, télétravail) sont faites à partir du texte de l'annonce.
 */
export function normalizeJob(raw: RawJob, source: { key: string; type: NormalizedJob["source"]; isDemo: boolean }): NormalizedJob {
  const fullText = [raw.title, raw.description, ...(raw.missions ?? []), ...(raw.requirements ?? [])].join("\n");
  const city = findCity(raw.city);
  const depCode = departmentCodeFromPostal(raw.postalCode) ?? departmentCodeFromPostal(raw.inseeCode);
  const dep = findDepartmentByCode(depCode);
  const levels = inferEducationRange(fullText);
  const jobFamily = (raw.jobFamily as JobFamilyKey | null) ?? guessJobFamily(`${raw.title} ${raw.description.slice(0, 400)}`) ?? "project";
  const sector = raw.sector ?? JOB_FAMILIES[jobFamily]?.sectors[0] ?? "tech";
  const extracted = extractSkills(fullText, { includeSoft: false });
  const skillsText = Array.from(new Set([...(raw.skills ?? []), ...extracted.map((s) => s.name)]));
  const companyName = raw.companyName?.trim() || UNKNOWN_EMPLOYER_NAME;
  const cityName = city?.name ?? raw.city?.trim() ?? "";
  const title = raw.title.trim();

  return {
    externalId: raw.externalId,
    title,
    normalizedTitle: normalizeJobTitle(title),
    slugBase: slugify(`${title} ${companyName} ${cityName}`).slice(0, 90),
    companyName,
    companyNameRaw: raw.companyName?.trim() || null,
    companyNameNormalized: normalizeCompanyName(companyName),
    companyWebsite: isValidUrl(raw.companyWebsite) ? raw.companyWebsite : null,
    companyDescription: raw.companyDescription?.trim() || null,
    companyLogoUrl: isValidUrl(raw.companyLogoUrl) ? raw.companyLogoUrl : null,
    description: raw.description.trim(),
    missions: raw.missions ?? [],
    requirements: raw.requirements ?? [],
    benefits: raw.benefits ?? [],
    skillsText,
    skillSlugs: skillSlugs(skillsText),
    city: cityName,
    postalCode: raw.postalCode ?? city?.postalCode ?? null,
    department: raw.department ?? dep?.name ?? city?.department ?? null,
    region: raw.region ?? dep?.region ?? city?.region ?? null,
    latitude: raw.latitude ?? city?.lat ?? null,
    longitude: raw.longitude ?? city?.lng ?? null,
    contractType: raw.contractType ?? inferContractType(fullText),
    educationLevelMin: raw.educationLevelMin ?? levels.min,
    educationLevelMax: raw.educationLevelMax ?? levels.max,
    durationMonths: raw.durationMonths ?? inferDuration(fullText),
    rhythm: raw.rhythm ?? inferRhythm(fullText),
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    salaryPeriod: raw.salaryPeriod ?? (raw.salaryMin || raw.salaryMax ? "MONTH" : null),
    remote: raw.remote ?? inferRemote(fullText),
    startDate: raw.startDate ?? null,
    publishedAt: raw.publishedAt,
    updatedAt: raw.updatedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    source: source.type,
    sourceKey: source.key,
    sourceUrl: isValidUrl(raw.sourceUrl) ? raw.sourceUrl : null,
    applicationUrl: isValidUrl(raw.applicationUrl) ? raw.applicationUrl : isValidUrl(raw.sourceUrl) ? raw.sourceUrl : null,
    applicationEmail: raw.applicationEmail ?? null,
    applicationLabel: raw.applicationLabel ?? null,
    sector,
    jobFamily,
    romeCode: raw.romeCode ?? null,
    nafCode: raw.nafCode ?? null,
    positionsCount: raw.positionsCount ?? null,
    isDemo: source.isDemo,
    raw: raw.raw ?? null,
  };
}

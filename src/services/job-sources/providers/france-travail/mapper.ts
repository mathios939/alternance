import { z } from "zod";
import type { EducationLevel, SalaryPeriod } from "@/generated/prisma/enums";
import { findCity } from "@/config/cities";
import { departmentCodeFromPostal, findDepartmentByCode } from "@/config/departments";
import type { RawJob } from "../../types";

/**
 * Schéma tolérant d'une offre France Travail (API Offres d'emploi v2).
 * Tous les champs sont optionnels : la validation métier se fait dans le pipeline.
 * Les champs inconnus sont conservés (loose) pour ne rien perdre dans `rawPayload`.
 */
const str = z.string().nullish();
const num = z.number().nullish();

export const ftOfferSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).transform(String),
  intitule: str,
  description: str,
  dateCreation: str,
  dateActualisation: str,
  lieuTravail: z.looseObject({ libelle: str, latitude: num, longitude: num, codePostal: str, commune: str }).nullish(),
  romeCode: str,
  romeLibelle: str,
  appellationlibelle: str,
  entreprise: z.looseObject({ nom: str, description: str, logo: str, url: str, entrepriseAdaptee: z.boolean().nullish() }).nullish(),
  typeContrat: str,
  typeContratLibelle: str,
  natureContrat: str,
  experienceExige: str,
  experienceLibelle: str,
  formations: z.array(z.looseObject({ codeFormation: str, domaineLibelle: str, niveauLibelle: str, commentaire: str, exigence: str })).nullish(),
  competences: z.array(z.looseObject({ code: str, libelle: str, exigence: str })).nullish(),
  qualitesProfessionnelles: z.array(z.looseObject({ libelle: str, description: str })).nullish(),
  salaire: z.looseObject({ libelle: str, commentaire: str, complement1: str, complement2: str }).nullish(),
  dureeTravailLibelle: str,
  dureeTravailLibelleConverti: str,
  alternance: z.boolean().nullish(),
  contact: z.looseObject({ nom: str, coordonnees1: str, coordonnees2: str, coordonnees3: str, telephone: str, courriel: str, commentaire: str, urlRecruteur: str, urlPostulation: str }).nullish(),
  nombrePostes: num,
  accessibleTH: z.boolean().nullish(),
  codeNAF: str,
  secteurActivite: str,
  secteurActiviteLibelle: str,
  origineOffre: z.looseObject({ origine: z.union([z.string(), z.number()]).nullish(), urlOrigine: str, partenaires: z.array(z.looseObject({ nom: str, url: str, logo: str })).nullish() }).nullish(),
});

export type FtOffer = z.infer<typeof ftOfferSchema>;

export const FT_CANDIDATE_URL = (id: string) => `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(id)}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** « 44 - NANTES » → « Nantes » ; « PARIS 12 » → « Paris 12 ». */
export function cleanCityLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const stripped = label.replace(/^\s*\d{2,3}\s*-\s*/, "").trim();
  if (!stripped) return null;
  const known = findCity(stripped);
  if (known) return known.name;
  return stripped
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((part) => (/^[\s\-']$/.test(part) || part === "" ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
    .replace(/\bSur\b/g, "sur")
    .replace(/\bLes\b/g, "les")
    .replace(/\bLe\b(?!$)/g, (m, offset: number) => (offset === 0 ? "Le" : "le"))
    .replace(/\bDe\b/g, "de")
    .replace(/\bDu\b/g, "du")
    .replace(/\bEn\b/g, "en")
    .replace(/\bEt\b/g, "et")
    .replace(/\bLa\b(?!$)/g, (m, offset: number) => (offset === 0 ? "La" : "la"));
}

/** Niveau de formation à partir des libellés France Travail (« Bac+2 ou équivalents », « CAP, BEP et équivalents »…). */
export function parseEducationLevel(label: string | null | undefined): EducationLevel | null {
  if (!label) return null;
  const t = label.toLowerCase();
  const plus = t.match(/bac\s*\+\s*(\d)/);
  if (plus) {
    const n = Number(plus[1]);
    if (n >= 5) return "BAC5";
    if (n === 4) return "BAC4";
    if (n === 3) return "BAC3";
    if (n === 2) return "BAC2";
    if (n === 1) return "BAC1";
  }
  if (/\bbac\b/.test(t)) return "BAC";
  if (/\bcap\b|\bbep\b/.test(t)) return "CAP";
  return null;
}

const LEVEL_ORDER: EducationLevel[] = ["CAP", "BAC", "BAC1", "BAC2", "BAC3", "BAC4", "BAC5"];

export function parseEducationRange(formations: FtOffer["formations"]): { min: EducationLevel | null; max: EducationLevel | null } {
  const levels = (formations ?? []).map((f) => parseEducationLevel(f.niveauLibelle)).filter((l): l is EducationLevel => l !== null);
  if (levels.length === 0) return { min: null, max: null };
  const sorted = [...new Set(levels)].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
  return { min: sorted[0] ?? null, max: sorted[sorted.length - 1] ?? null };
}

/** « Contrat à durée déterminée - 24 Mois » → 24. */
export function parseContractDuration(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d{1,2})\s*mois/i);
  if (m) return Number(m[1]);
  const y = label.match(/(\d)\s*an/i);
  return y ? Number(y[1]) * 12 : null;
}

export type ParsedSalary = { min: number | null; max: number | null; period: SalaryPeriod | null };

/**
 * « Mensuel de 759.00 Euros à 1766.00 Euros sur 12 mois » → { 759, 1766, MONTH }
 * « Annuel de 21000.00 Euros » → { 21000, 21000, YEAR } ; « Horaire de 11.88 Euros » → HOUR.
 * « Selon profil », « % du SMIC » → rien (pas de valeur inventée).
 */
export function parseSalary(label: string | null | undefined): ParsedSalary {
  if (!label) return { min: null, max: null, period: null };
  const t = label.toLowerCase();
  const period: SalaryPeriod | null = t.startsWith("mensuel") ? "MONTH" : t.startsWith("annuel") ? "YEAR" : t.startsWith("horaire") ? "HOUR" : null;
  if (!period) return { min: null, max: null, period: null };
  const amounts = [...t.matchAll(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:€|euros?)/g)].map((m) => Number((m[1] ?? "").replace(/\s/g, "").replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
  if (amounts.length === 0) return { min: null, max: null, period };
  const min = Math.round(Math.min(...amounts));
  const max = Math.round(Math.max(...amounts));
  return { min, max, period };
}

/** Code nature de contrat → type interne. Basé sur le libellé (les codes E2/FS sont validés par le référentiel). */
export function parseContractType(natureContrat: string | null | undefined, alternance: boolean | null | undefined): RawJob["contractType"] {
  const t = (natureContrat ?? "").toLowerCase();
  if (/apprentissage/.test(t)) return "APPRENTISSAGE";
  if (/professionnalisation/.test(t)) return "PROFESSIONNALISATION";
  return alternance ? "APPRENTISSAGE" : null;
}

/** Transforme une offre validée en RawJob. Rien n'est deviné : ce qui manque reste null. */
export function mapFtOffer(o: FtOffer): RawJob {
  const lieu = o.lieuTravail ?? null;
  const postalCode = lieu?.codePostal ?? null;
  const inseeCode = lieu?.commune ?? null;
  const depCode = lieu?.libelle?.match(/^\s*(\d{2,3}|2[AB])\s*-/i)?.[1] ?? departmentCodeFromPostal(postalCode) ?? departmentCodeFromPostal(inseeCode);
  const dep = findDepartmentByCode(depCode);
  const levels = parseEducationRange(o.formations);
  const salary = parseSalary(o.salaire?.libelle);
  const contractType = parseContractType(o.natureContrat, o.alternance);
  const isPartner = String(o.origineOffre?.origine ?? "") === "2";
  const sourceUrl = FT_CANDIDATE_URL(o.id);
  const applicationUrl = o.contact?.urlPostulation?.trim() || (isPartner ? o.origineOffre?.urlOrigine?.trim() : null) || o.contact?.urlRecruteur?.trim() || sourceUrl;
  const email = o.contact?.courriel?.trim().toLowerCase() ?? null;

  return {
    externalId: o.id,
    title: (o.intitule ?? "").trim(),
    companyName: o.entreprise?.nom?.trim() || null,
    companyWebsite: o.entreprise?.url?.trim() || null,
    companyDescription: o.entreprise?.description?.trim() || null,
    companyLogoUrl: o.entreprise?.logo?.trim() || null,
    description: (o.description ?? "").trim(),
    skills: (o.competences ?? []).map((c) => c.libelle?.trim() ?? "").filter(Boolean),
    requirements: (o.qualitesProfessionnelles ?? []).map((q) => q.libelle?.trim() ?? "").filter(Boolean),
    city: cleanCityLabel(lieu?.libelle),
    postalCode,
    inseeCode,
    department: dep?.name ?? null,
    region: dep?.region ?? null,
    latitude: typeof lieu?.latitude === "number" ? lieu.latitude : null,
    longitude: typeof lieu?.longitude === "number" ? lieu.longitude : null,
    contractType,
    isAlternance: o.alternance === true || contractType !== null,
    educationLevelMin: levels.min,
    educationLevelMax: levels.max,
    durationMonths: parseContractDuration(o.typeContratLibelle),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryPeriod: salary.period,
    remote: null,
    publishedAt: o.dateCreation ? new Date(o.dateCreation) : new Date(NaN),
    updatedAt: o.dateActualisation ? new Date(o.dateActualisation) : null,
    expiresAt: null,
    sourceUrl,
    applicationUrl,
    applicationEmail: email && EMAIL_RE.test(email) ? email : null,
    applicationLabel: o.contact?.nom?.trim().slice(0, 200) || null,
    romeCode: o.romeCode ?? null,
    nafCode: o.codeNAF ?? null,
    positionsCount: typeof o.nombrePostes === "number" ? o.nombrePostes : null,
    raw: o,
  };
}

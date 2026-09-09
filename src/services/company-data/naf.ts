import type { CompanySize } from "@/generated/prisma/enums";

/**
 * Correspondances NAF (INSEE) → secteur et familles de métiers de la taxonomie interne.
 * Volontairement partielles : ce qui n'est pas listé tombe sur « other » sans invention.
 */
export type NafMapping = { sector: string; jobFamilies: string[]; label: string };

/** Codes / préfixes NAF (division 2 chiffres ou code complet) → mapping. Le plus spécifique gagne. */
export const NAF_MAPPINGS: Record<string, NafMapping> = {
  "62": { sector: "tech", jobFamilies: ["dev", "infra", "data", "cyber"], label: "Programmation, conseil et autres activités informatiques" },
  "62.01Z": { sector: "tech", jobFamilies: ["dev", "data"], label: "Programmation informatique" },
  "62.02A": { sector: "tech", jobFamilies: ["infra", "dev", "cyber"], label: "Conseil en systèmes et logiciels informatiques" },
  "62.02B": { sector: "tech", jobFamilies: ["infra", "support"], label: "Tierce maintenance de systèmes et d'applications informatiques" },
  "62.03Z": { sector: "tech", jobFamilies: ["infra"], label: "Gestion d'installations informatiques" },
  "62.09Z": { sector: "tech", jobFamilies: ["infra", "support"], label: "Autres activités informatiques" },
  "63": { sector: "tech", jobFamilies: ["data", "dev"], label: "Services d'information" },
  "63.11Z": { sector: "tech", jobFamilies: ["data", "infra"], label: "Traitement de données, hébergement et activités connexes" },
  "63.12Z": { sector: "tech", jobFamilies: ["dev", "marketing"], label: "Portails Internet" },
  "58.2": { sector: "tech", jobFamilies: ["dev", "product"], label: "Édition de logiciels" },
  "58.21Z": { sector: "tech", jobFamilies: ["dev", "design"], label: "Édition de jeux électroniques" },
  "58.29A": { sector: "tech", jobFamilies: ["dev", "product"], label: "Édition de logiciels système et de réseau" },
  "58.29B": { sector: "tech", jobFamilies: ["dev", "product"], label: "Édition de logiciels outils de développement et de langages" },
  "58.29C": { sector: "tech", jobFamilies: ["dev", "product"], label: "Édition de logiciels applicatifs" },
  "73": { sector: "marketing", jobFamilies: ["marketing", "communication", "design"], label: "Publicité et études de marché" },
  "73.11Z": { sector: "marketing", jobFamilies: ["marketing", "communication", "design"], label: "Activités des agences de publicité" },
  "73.12Z": { sector: "marketing", jobFamilies: ["marketing", "sales"], label: "Régie publicitaire de médias" },
  "73.20Z": { sector: "marketing", jobFamilies: ["marketing", "data"], label: "Études de marché et sondages" },
  "70.21Z": { sector: "marketing", jobFamilies: ["communication"], label: "Conseil en relations publiques et communication" },
  "70.22Z": { sector: "consulting", jobFamilies: ["project", "finance", "hr"], label: "Conseil pour les affaires et autres conseils de gestion" },
  "69.20Z": { sector: "finance", jobFamilies: ["accounting", "finance"], label: "Activités comptables" },
  "69.10Z": { sector: "legal", jobFamilies: ["legal"], label: "Activités juridiques" },
  "64": { sector: "finance", jobFamilies: ["finance", "sales", "customer"], label: "Activités des services financiers" },
  "65": { sector: "finance", jobFamilies: ["finance", "customer", "sales"], label: "Assurance" },
  "66": { sector: "finance", jobFamilies: ["finance", "sales"], label: "Activités auxiliaires de services financiers et d'assurance" },
  "71.12B": { sector: "industry", jobFamilies: ["engineering", "project"], label: "Ingénierie, études techniques" },
  "71.20B": { sector: "industry", jobFamilies: ["quality", "engineering"], label: "Analyses, essais et inspections techniques" },
  "74.10Z": { sector: "marketing", jobFamilies: ["design"], label: "Activités spécialisées de design" },
  "74.20Z": { sector: "marketing", jobFamilies: ["design", "communication"], label: "Activités photographiques" },
  "78": { sector: "hr", jobFamilies: ["hr", "sales"], label: "Activités liées à l'emploi" },
  "82": { sector: "services", jobFamilies: ["admin", "customer", "sales"], label: "Activités administratives et autres activités de soutien aux entreprises" },
  "47": { sector: "retail", jobFamilies: ["retail", "sales", "logistics"], label: "Commerce de détail" },
  "46": { sector: "retail", jobFamilies: ["sales", "purchasing", "logistics"], label: "Commerce de gros" },
  "45": { sector: "industry", jobFamilies: ["sales", "engineering", "customer"], label: "Commerce et réparation d'automobiles et de motocycles" },
  "49": { sector: "logistics", jobFamilies: ["logistics"], label: "Transports terrestres" },
  "52": { sector: "logistics", jobFamilies: ["logistics", "purchasing"], label: "Entreposage et services auxiliaires des transports" },
  "10": { sector: "industry", jobFamilies: ["quality", "engineering", "logistics"], label: "Industries alimentaires" },
  "25": { sector: "industry", jobFamilies: ["engineering", "quality"], label: "Fabrication de produits métalliques" },
  "26": { sector: "industry", jobFamilies: ["engineering", "dev", "quality"], label: "Fabrication de produits informatiques, électroniques et optiques" },
  "27": { sector: "industry", jobFamilies: ["engineering", "quality"], label: "Fabrication d'équipements électriques" },
  "28": { sector: "industry", jobFamilies: ["engineering", "quality", "purchasing"], label: "Fabrication de machines et équipements" },
  "29": { sector: "industry", jobFamilies: ["engineering", "quality", "logistics"], label: "Industrie automobile" },
  "30": { sector: "industry", jobFamilies: ["engineering", "quality"], label: "Fabrication d'autres matériels de transport" },
  "33": { sector: "industry", jobFamilies: ["engineering", "support"], label: "Réparation et installation de machines et d'équipements" },
  "35": { sector: "energy", jobFamilies: ["engineering", "project"], label: "Production et distribution d'électricité, de gaz" },
  "41": { sector: "construction", jobFamilies: ["engineering", "project", "admin"], label: "Construction de bâtiments" },
  "42": { sector: "construction", jobFamilies: ["engineering", "project"], label: "Génie civil" },
  "43": { sector: "construction", jobFamilies: ["engineering", "admin"], label: "Travaux de construction spécialisés" },
  "55": { sector: "hospitality", jobFamilies: ["customer", "admin", "sales"], label: "Hébergement" },
  "56": { sector: "hospitality", jobFamilies: ["customer", "retail"], label: "Restauration" },
  "85": { sector: "education", jobFamilies: ["admin", "communication", "hr"], label: "Enseignement" },
  "86": { sector: "health", jobFamilies: ["health", "admin"], label: "Activités pour la santé humaine" },
  "87": { sector: "health", jobFamilies: ["health", "admin"], label: "Hébergement médico-social et social" },
  "88": { sector: "health", jobFamilies: ["health", "admin"], label: "Action sociale sans hébergement" },
  "84": { sector: "public", jobFamilies: ["admin", "communication", "project"], label: "Administration publique" },
  "90": { sector: "culture", jobFamilies: ["communication", "design"], label: "Activités créatives, artistiques et de spectacle" },
  "94": { sector: "association", jobFamilies: ["communication", "admin", "project"], label: "Activités des organisations associatives" },
};

/** Mapping le plus spécifique pour un code NAF (« 62.01Z » → code complet, sinon « 62.0 », sinon « 62 »). */
export function nafMapping(code: string | null | undefined): NafMapping | null {
  if (!code) return null;
  const c = code.toUpperCase().replace(/\s/g, "");
  const candidates = [c, c.slice(0, 4), c.slice(0, 2)];
  for (const k of candidates) {
    const m = NAF_MAPPINGS[k];
    if (m) return m;
  }
  return null;
}

/** Tranches d'effectif salarié INSEE (code → libellé et bornes). Source : nomenclature SIRENE. */
export const EMPLOYEE_RANGES: Record<string, { label: string; min: number; max: number | null }> = {
  NN: { label: "Effectif non renseigné", min: 0, max: null },
  "00": { label: "0 salarié", min: 0, max: 0 },
  "01": { label: "1 ou 2 salariés", min: 1, max: 2 },
  "02": { label: "3 à 5 salariés", min: 3, max: 5 },
  "03": { label: "6 à 9 salariés", min: 6, max: 9 },
  "11": { label: "10 à 19 salariés", min: 10, max: 19 },
  "12": { label: "20 à 49 salariés", min: 20, max: 49 },
  "21": { label: "50 à 99 salariés", min: 50, max: 99 },
  "22": { label: "100 à 199 salariés", min: 100, max: 199 },
  "31": { label: "200 à 249 salariés", min: 200, max: 249 },
  "32": { label: "250 à 499 salariés", min: 250, max: 499 },
  "41": { label: "500 à 999 salariés", min: 500, max: 999 },
  "42": { label: "1 000 à 1 999 salariés", min: 1000, max: 1999 },
  "51": { label: "2 000 à 4 999 salariés", min: 2000, max: 4999 },
  "52": { label: "5 000 à 9 999 salariés", min: 5000, max: 9999 },
  "53": { label: "10 000 salariés et plus", min: 10000, max: null },
};

/** Taille interne (TPE / PME / ETI / GE) déduite d'une tranche INSEE ; null si inconnue. */
export function sizeFromEmployeeRange(code: string | null | undefined): CompanySize | null {
  if (!code || code === "NN") return null;
  const range = EMPLOYEE_RANGES[code];
  if (!range) return null;
  if (range.min >= 5000) return "GE";
  if (range.min >= 250) return "ETI";
  if (range.min >= 10) return "PME";
  return "TPE";
}

/** Taille interne à partir de la catégorie INSEE (PME/ETI/GE) quand la tranche manque. */
export function sizeFromCategory(category: string | null | undefined, employeeRange: string | null | undefined): CompanySize | null {
  const fromRange = sizeFromEmployeeRange(employeeRange);
  if (fromRange) return fromRange;
  if (category === "GE") return "GE";
  if (category === "ETI") return "ETI";
  if (category === "PME") return "PME";
  return null;
}

/** Sections NAF exploitables pour la découverte d'entreprises par métier. */
export const JOB_FAMILY_NAF_HINTS: Record<string, string[]> = {
  dev: ["62.01Z", "62.02A", "58.29C", "63.12Z", "62.09Z"],
  data: ["62.01Z", "63.11Z", "73.20Z", "62.02A"],
  cyber: ["62.02A", "62.01Z", "62.09Z"],
  infra: ["62.02A", "62.03Z", "62.09Z", "63.11Z", "62.02B"],
  product: ["62.01Z", "58.29C", "62.02A"],
  design: ["74.10Z", "73.11Z", "62.01Z"],
  marketing: ["73.11Z", "73.12Z", "73.20Z", "63.12Z", "70.21Z"],
  communication: ["70.21Z", "73.11Z", "90"],
  sales: ["46", "47", "73.12Z", "70.22Z"],
  hr: ["78", "70.22Z"],
  finance: ["64", "65", "66", "69.20Z", "70.22Z"],
  accounting: ["69.20Z", "70.22Z"],
  legal: ["69.10Z"],
  logistics: ["49", "52", "46"],
  engineering: ["71.12B", "25", "26", "27", "28", "29", "30", "33"],
  quality: ["71.20B", "10", "26", "28"],
  purchasing: ["46", "28"],
  admin: ["82", "70.22Z"],
  customer: ["82", "64", "65"],
  project: ["70.22Z", "71.12B", "62.02A"],
  health: ["86", "87", "88"],
  retail: ["47"],
};

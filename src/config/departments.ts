/** Départements français métropolitains et d'outre-mer : code → nom et région (référentiel INSEE). */
export type Department = { code: string; name: string; region: string };

const D = (code: string, name: string, region: string): Department => ({ code, name, region });

export const DEPARTMENTS: Department[] = [
  D("01", "Ain", "Auvergne-Rhône-Alpes"),
  D("02", "Aisne", "Hauts-de-France"),
  D("03", "Allier", "Auvergne-Rhône-Alpes"),
  D("04", "Alpes-de-Haute-Provence", "Provence-Alpes-Côte d'Azur"),
  D("05", "Hautes-Alpes", "Provence-Alpes-Côte d'Azur"),
  D("06", "Alpes-Maritimes", "Provence-Alpes-Côte d'Azur"),
  D("07", "Ardèche", "Auvergne-Rhône-Alpes"),
  D("08", "Ardennes", "Grand Est"),
  D("09", "Ariège", "Occitanie"),
  D("10", "Aube", "Grand Est"),
  D("11", "Aude", "Occitanie"),
  D("12", "Aveyron", "Occitanie"),
  D("13", "Bouches-du-Rhône", "Provence-Alpes-Côte d'Azur"),
  D("14", "Calvados", "Normandie"),
  D("15", "Cantal", "Auvergne-Rhône-Alpes"),
  D("16", "Charente", "Nouvelle-Aquitaine"),
  D("17", "Charente-Maritime", "Nouvelle-Aquitaine"),
  D("18", "Cher", "Centre-Val de Loire"),
  D("19", "Corrèze", "Nouvelle-Aquitaine"),
  D("2A", "Corse-du-Sud", "Corse"),
  D("2B", "Haute-Corse", "Corse"),
  D("21", "Côte-d'Or", "Bourgogne-Franche-Comté"),
  D("22", "Côtes-d'Armor", "Bretagne"),
  D("23", "Creuse", "Nouvelle-Aquitaine"),
  D("24", "Dordogne", "Nouvelle-Aquitaine"),
  D("25", "Doubs", "Bourgogne-Franche-Comté"),
  D("26", "Drôme", "Auvergne-Rhône-Alpes"),
  D("27", "Eure", "Normandie"),
  D("28", "Eure-et-Loir", "Centre-Val de Loire"),
  D("29", "Finistère", "Bretagne"),
  D("30", "Gard", "Occitanie"),
  D("31", "Haute-Garonne", "Occitanie"),
  D("32", "Gers", "Occitanie"),
  D("33", "Gironde", "Nouvelle-Aquitaine"),
  D("34", "Hérault", "Occitanie"),
  D("35", "Ille-et-Vilaine", "Bretagne"),
  D("36", "Indre", "Centre-Val de Loire"),
  D("37", "Indre-et-Loire", "Centre-Val de Loire"),
  D("38", "Isère", "Auvergne-Rhône-Alpes"),
  D("39", "Jura", "Bourgogne-Franche-Comté"),
  D("40", "Landes", "Nouvelle-Aquitaine"),
  D("41", "Loir-et-Cher", "Centre-Val de Loire"),
  D("42", "Loire", "Auvergne-Rhône-Alpes"),
  D("43", "Haute-Loire", "Auvergne-Rhône-Alpes"),
  D("44", "Loire-Atlantique", "Pays de la Loire"),
  D("45", "Loiret", "Centre-Val de Loire"),
  D("46", "Lot", "Occitanie"),
  D("47", "Lot-et-Garonne", "Nouvelle-Aquitaine"),
  D("48", "Lozère", "Occitanie"),
  D("49", "Maine-et-Loire", "Pays de la Loire"),
  D("50", "Manche", "Normandie"),
  D("51", "Marne", "Grand Est"),
  D("52", "Haute-Marne", "Grand Est"),
  D("53", "Mayenne", "Pays de la Loire"),
  D("54", "Meurthe-et-Moselle", "Grand Est"),
  D("55", "Meuse", "Grand Est"),
  D("56", "Morbihan", "Bretagne"),
  D("57", "Moselle", "Grand Est"),
  D("58", "Nièvre", "Bourgogne-Franche-Comté"),
  D("59", "Nord", "Hauts-de-France"),
  D("60", "Oise", "Hauts-de-France"),
  D("61", "Orne", "Normandie"),
  D("62", "Pas-de-Calais", "Hauts-de-France"),
  D("63", "Puy-de-Dôme", "Auvergne-Rhône-Alpes"),
  D("64", "Pyrénées-Atlantiques", "Nouvelle-Aquitaine"),
  D("65", "Hautes-Pyrénées", "Occitanie"),
  D("66", "Pyrénées-Orientales", "Occitanie"),
  D("67", "Bas-Rhin", "Grand Est"),
  D("68", "Haut-Rhin", "Grand Est"),
  D("69", "Rhône", "Auvergne-Rhône-Alpes"),
  D("70", "Haute-Saône", "Bourgogne-Franche-Comté"),
  D("71", "Saône-et-Loire", "Bourgogne-Franche-Comté"),
  D("72", "Sarthe", "Pays de la Loire"),
  D("73", "Savoie", "Auvergne-Rhône-Alpes"),
  D("74", "Haute-Savoie", "Auvergne-Rhône-Alpes"),
  D("75", "Paris", "Île-de-France"),
  D("76", "Seine-Maritime", "Normandie"),
  D("77", "Seine-et-Marne", "Île-de-France"),
  D("78", "Yvelines", "Île-de-France"),
  D("79", "Deux-Sèvres", "Nouvelle-Aquitaine"),
  D("80", "Somme", "Hauts-de-France"),
  D("81", "Tarn", "Occitanie"),
  D("82", "Tarn-et-Garonne", "Occitanie"),
  D("83", "Var", "Provence-Alpes-Côte d'Azur"),
  D("84", "Vaucluse", "Provence-Alpes-Côte d'Azur"),
  D("85", "Vendée", "Pays de la Loire"),
  D("86", "Vienne", "Nouvelle-Aquitaine"),
  D("87", "Haute-Vienne", "Nouvelle-Aquitaine"),
  D("88", "Vosges", "Grand Est"),
  D("89", "Yonne", "Bourgogne-Franche-Comté"),
  D("90", "Territoire de Belfort", "Bourgogne-Franche-Comté"),
  D("91", "Essonne", "Île-de-France"),
  D("92", "Hauts-de-Seine", "Île-de-France"),
  D("93", "Seine-Saint-Denis", "Île-de-France"),
  D("94", "Val-de-Marne", "Île-de-France"),
  D("95", "Val-d'Oise", "Île-de-France"),
  D("971", "Guadeloupe", "Guadeloupe"),
  D("972", "Martinique", "Martinique"),
  D("973", "Guyane", "Guyane"),
  D("974", "La Réunion", "La Réunion"),
  D("976", "Mayotte", "Mayotte"),
];

const BY_CODE = new Map(DEPARTMENTS.map((d) => [d.code, d]));

/** Régions (métropole et outre-mer), dans l'ordre du référentiel. */
export const REGIONS: string[] = Array.from(new Set(DEPARTMENTS.map((d) => d.region)));

const REGION_KEYS = new Set(
  REGIONS.map((r) =>
    r
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, ""),
  ),
);

/** Vrai si le libellé désigne une région (insensible aux accents, à la casse et à la ponctuation). */
export function isRegionName(label: string | null | undefined): boolean {
  if (!label) return false;
  return REGION_KEYS.has(
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, ""),
  );
}

/** Codes des départements d'une région (nom exact du référentiel, comparaison insensible aux accents). */
export function departmentCodesOfRegion(region: string): string[] {
  const key = region
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return DEPARTMENTS.filter(
    (d) =>
      d.region
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "") === key,
  ).map((d) => d.code);
}

export function findDepartmentByCode(code: string | null | undefined): Department | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  return BY_CODE.get(c) ?? BY_CODE.get(c.padStart(2, "0"));
}

/** Code département à partir d'un code postal ou d'un code INSEE (gère la Corse et l'outre-mer). */
export function departmentCodeFromPostal(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim();
  if (!/^\d{5}$/.test(c) && !/^2[AB]\d{3}$/i.test(c)) return null;
  if (c.startsWith("97") || c.startsWith("98")) return c.slice(0, 3);
  if (c.startsWith("20")) return Number(c) < 20200 ? "2A" : "2B";
  if (/^2[AB]/i.test(c)) return c.slice(0, 2).toUpperCase();
  return c.slice(0, 2);
}

/** Départements prioritaires pour l'amorçage des données réelles (Pays de la Loire, Bretagne). */
export const PRIORITY_DEPARTMENT_CODES = [
  "44",
  "49",
  "53",
  "72",
  "85",
  "35",
  "29",
  "56",
  "22",
] as const;

/** Zones très demandées (grandes métropoles) : synchronisées plus souvent que le reste du catalogue. */
export const HOT_DEPARTMENT_CODES = [
  "75",
  "92",
  "93",
  "94",
  "69",
  "13",
  "31",
  "33",
  "59",
  "34",
  "67",
  "06",
  "38",
  "76",
  "78",
  "91",
  "95",
  "77",
  "45",
  "63",
] as const;

/** Tous les codes de départements (métropole puis outre-mer), ordre du référentiel. */
export const ALL_DEPARTMENT_CODES: string[] = DEPARTMENTS.map((d) => d.code);

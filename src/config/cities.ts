export type City = {
  name: string;
  slug: string;
  postalCode: string;
  department: string;
  departmentCode: string;
  region: string;
  lat: number;
  lng: number;
  /** Zones prioritaires pour l'expérience produit (Pays de la Loire, Bretagne). */
  priority: 1 | 2 | 3;
  /** Code INSEE de la commune (attendu par l'API France Travail). Vérifié par `npm run test:france-travail`. */
  inseeCode?: string;
  population?: number;
};

export const CITIES: City[] = [
  // ── Pays de la Loire ──
  { name: "Nantes", slug: "nantes", postalCode: "44000", inseeCode: "44109", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.2184, lng: -1.5536, priority: 1, population: 320000 },
  { name: "Saint-Herblain", slug: "saint-herblain", postalCode: "44800", inseeCode: "44162", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.2122, lng: -1.6497, priority: 1, population: 48000 },
  { name: "Rezé", slug: "reze", postalCode: "44400", inseeCode: "44143", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.1833, lng: -1.5500, priority: 1, population: 43000 },
  { name: "Saint-Nazaire", slug: "saint-nazaire", postalCode: "44600", inseeCode: "44184", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.2736, lng: -2.2139, priority: 1, population: 72000 },
  { name: "Carquefou", slug: "carquefou", postalCode: "44470", inseeCode: "44026", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.2975, lng: -1.4914, priority: 1, population: 20000 },
  { name: "Orvault", slug: "orvault", postalCode: "44700", inseeCode: "44114", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.2711, lng: -1.6231, priority: 1, population: 27000 },
  { name: "Vertou", slug: "vertou", postalCode: "44120", inseeCode: "44215", department: "Loire-Atlantique", departmentCode: "44", region: "Pays de la Loire", lat: 47.1686, lng: -1.4692, priority: 1, population: 25000 },
  { name: "Angers", slug: "angers", postalCode: "49000", inseeCode: "49007", department: "Maine-et-Loire", departmentCode: "49", region: "Pays de la Loire", lat: 47.4784, lng: -0.5632, priority: 1, population: 155000 },
  { name: "Cholet", slug: "cholet", postalCode: "49300", inseeCode: "49099", department: "Maine-et-Loire", departmentCode: "49", region: "Pays de la Loire", lat: 47.0594, lng: -0.8797, priority: 1, population: 54000 },
  { name: "Le Mans", slug: "le-mans", postalCode: "72000", inseeCode: "72181", department: "Sarthe", departmentCode: "72", region: "Pays de la Loire", lat: 48.0061, lng: 0.1996, priority: 1, population: 145000 },
  { name: "Laval", slug: "laval", postalCode: "53000", inseeCode: "53130", department: "Mayenne", departmentCode: "53", region: "Pays de la Loire", lat: 48.0709, lng: -0.7700, priority: 1, population: 50000 },
  { name: "La Roche-sur-Yon", slug: "la-roche-sur-yon", postalCode: "85000", inseeCode: "85191", department: "Vendée", departmentCode: "85", region: "Pays de la Loire", lat: 46.6705, lng: -1.4260, priority: 1, population: 55000 },
  // ── Bretagne ──
  { name: "Rennes", slug: "rennes", postalCode: "35000", inseeCode: "35238", department: "Ille-et-Vilaine", departmentCode: "35", region: "Bretagne", lat: 48.1173, lng: -1.6778, priority: 1, population: 222000 },
  { name: "Cesson-Sévigné", slug: "cesson-sevigne", postalCode: "35510", inseeCode: "35051", department: "Ille-et-Vilaine", departmentCode: "35", region: "Bretagne", lat: 48.1211, lng: -1.6034, priority: 1, population: 18000 },
  { name: "Saint-Malo", slug: "saint-malo", postalCode: "35400", inseeCode: "35288", department: "Ille-et-Vilaine", departmentCode: "35", region: "Bretagne", lat: 48.6493, lng: -2.0257, priority: 1, population: 47000 },
  { name: "Brest", slug: "brest", postalCode: "29200", inseeCode: "29019", department: "Finistère", departmentCode: "29", region: "Bretagne", lat: 48.3904, lng: -4.4861, priority: 1, population: 140000 },
  { name: "Quimper", slug: "quimper", postalCode: "29000", inseeCode: "29232", department: "Finistère", departmentCode: "29", region: "Bretagne", lat: 47.9960, lng: -4.1024, priority: 1, population: 63000 },
  { name: "Lorient", slug: "lorient", postalCode: "56100", inseeCode: "56121", department: "Morbihan", departmentCode: "56", region: "Bretagne", lat: 47.7483, lng: -3.3700, priority: 1, population: 57000 },
  { name: "Vannes", slug: "vannes", postalCode: "56000", inseeCode: "56260", department: "Morbihan", departmentCode: "56", region: "Bretagne", lat: 47.6582, lng: -2.7608, priority: 1, population: 54000 },
  { name: "Saint-Brieuc", slug: "saint-brieuc", postalCode: "22000", inseeCode: "22278", department: "Côtes-d'Armor", departmentCode: "22", region: "Bretagne", lat: 48.5141, lng: -2.7654, priority: 1, population: 45000 },
  { name: "Lannion", slug: "lannion", postalCode: "22300", inseeCode: "22113", department: "Côtes-d'Armor", departmentCode: "22", region: "Bretagne", lat: 48.7326, lng: -3.4594, priority: 1, population: 20000 },
  { name: "Fougères", slug: "fougeres", postalCode: "35300", inseeCode: "35115", department: "Ille-et-Vilaine", departmentCode: "35", region: "Bretagne", lat: 48.3525, lng: -1.1994, priority: 1, population: 20000 },
  // ── Grandes métropoles ──
  { name: "Paris", slug: "paris", postalCode: "75001", inseeCode: "75056", department: "Paris", departmentCode: "75", region: "Île-de-France", lat: 48.8566, lng: 2.3522, priority: 2, population: 2100000 },
  { name: "Lyon", slug: "lyon", postalCode: "69001", inseeCode: "69123", department: "Rhône", departmentCode: "69", region: "Auvergne-Rhône-Alpes", lat: 45.7640, lng: 4.8357, priority: 2, population: 520000 },
  { name: "Bordeaux", slug: "bordeaux", postalCode: "33000", inseeCode: "33063", department: "Gironde", departmentCode: "33", region: "Nouvelle-Aquitaine", lat: 44.8378, lng: -0.5792, priority: 2, population: 260000 },
  { name: "Lille", slug: "lille", postalCode: "59000", inseeCode: "59350", department: "Nord", departmentCode: "59", region: "Hauts-de-France", lat: 50.6292, lng: 3.0573, priority: 2, population: 235000 },
  { name: "Toulouse", slug: "toulouse", postalCode: "31000", inseeCode: "31555", department: "Haute-Garonne", departmentCode: "31", region: "Occitanie", lat: 43.6047, lng: 1.4442, priority: 2, population: 495000 },
  { name: "Montpellier", slug: "montpellier", postalCode: "34000", inseeCode: "34172", department: "Hérault", departmentCode: "34", region: "Occitanie", lat: 43.6108, lng: 3.8767, priority: 2, population: 300000 },
  { name: "Strasbourg", slug: "strasbourg", postalCode: "67000", inseeCode: "67482", department: "Bas-Rhin", departmentCode: "67", region: "Grand Est", lat: 48.5734, lng: 7.7521, priority: 2, population: 290000 },
  { name: "Marseille", slug: "marseille", postalCode: "13001", inseeCode: "13055", department: "Bouches-du-Rhône", departmentCode: "13", region: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lng: 5.3698, priority: 2, population: 870000 },
  { name: "Grenoble", slug: "grenoble", postalCode: "38000", inseeCode: "38185", department: "Isère", departmentCode: "38", region: "Auvergne-Rhône-Alpes", lat: 45.1885, lng: 5.7245, priority: 2, population: 160000 },
  { name: "Nice", slug: "nice", postalCode: "06000", inseeCode: "06088", department: "Alpes-Maritimes", departmentCode: "06", region: "Provence-Alpes-Côte d'Azur", lat: 43.7102, lng: 7.2620, priority: 2, population: 340000 },
  { name: "Tours", slug: "tours", postalCode: "37000", inseeCode: "37261", department: "Indre-et-Loire", departmentCode: "37", region: "Centre-Val de Loire", lat: 47.3941, lng: 0.6848, priority: 3, population: 137000 },
  { name: "Rouen", slug: "rouen", postalCode: "76000", inseeCode: "76540", department: "Seine-Maritime", departmentCode: "76", region: "Normandie", lat: 49.4432, lng: 1.0999, priority: 3, population: 112000 },
  { name: "Caen", slug: "caen", postalCode: "14000", inseeCode: "14118", department: "Calvados", departmentCode: "14", region: "Normandie", lat: 49.1829, lng: -0.3707, priority: 3, population: 106000 },
  { name: "Poitiers", slug: "poitiers", postalCode: "86000", inseeCode: "86194", department: "Vienne", departmentCode: "86", region: "Nouvelle-Aquitaine", lat: 46.5802, lng: 0.3404, priority: 3, population: 90000 },
  { name: "Orléans", slug: "orleans", postalCode: "45000", inseeCode: "45234", department: "Loiret", departmentCode: "45", region: "Centre-Val de Loire", lat: 47.9029, lng: 1.9093, priority: 3, population: 117000 },
  { name: "Nancy", slug: "nancy", postalCode: "54000", inseeCode: "54395", department: "Meurthe-et-Moselle", departmentCode: "54", region: "Grand Est", lat: 48.6921, lng: 6.1844, priority: 3, population: 105000 },
  { name: "Dijon", slug: "dijon", postalCode: "21000", inseeCode: "21231", department: "Côte-d'Or", departmentCode: "21", region: "Bourgogne-Franche-Comté", lat: 47.3220, lng: 5.0415, priority: 3, population: 160000 },
  { name: "Clermont-Ferrand", slug: "clermont-ferrand", postalCode: "63000", inseeCode: "63113", department: "Puy-de-Dôme", departmentCode: "63", region: "Auvergne-Rhône-Alpes", lat: 45.7772, lng: 3.0870, priority: 3, population: 147000 },
];

export const REGIONS = Array.from(new Set(CITIES.map((c) => c.region))).sort();

export const PRIORITY_CITIES = CITIES.filter((c) => c.priority === 1);
export const SEO_CITIES = CITIES.filter((c) => c.priority <= 2);

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function findCity(input: string | null | undefined): City | undefined {
  if (!input) return undefined;
  const q = normalize(input);
  if (!q) return undefined;
  return (
    CITIES.find((c) => normalize(c.name) === q || c.slug === q.replace(/\s+/g, "-")) ??
    CITIES.find((c) => normalize(c.name).startsWith(q)) ??
    CITIES.find((c) => q.includes(normalize(c.name)))
  );
}

export function findRegion(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const q = normalize(input);
  return REGIONS.find((r) => normalize(r) === q || normalize(r).includes(q));
}

export function findDepartment(input: string | null | undefined): { name: string; code: string; region: string } | undefined {
  if (!input) return undefined;
  const q = normalize(input);
  const c = CITIES.find((c) => normalize(c.department) === q || c.departmentCode === q);
  return c ? { name: c.department, code: c.departmentCode, region: c.region } : undefined;
}

export function searchCities(query: string, limit = 6): City[] {
  const q = normalize(query);
  if (!q) return PRIORITY_CITIES.slice(0, limit);
  return CITIES.filter((c) => normalize(c.name).includes(q) || c.postalCode.startsWith(q))
    .sort((a, b) => a.priority - b.priority || (b.population ?? 0) - (a.population ?? 0))
    .slice(0, limit);
}

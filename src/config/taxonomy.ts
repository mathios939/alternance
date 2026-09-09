import type { ContractType, EducationLevel, RemotePolicy, WorkRhythm, CompanySize, Mobility, ApplicationStatus } from "@/generated/prisma/enums";

// ─────────────────────────── SECTEURS ───────────────────────────
export type SectorKey =
  | "tech"
  | "digital-agency"
  | "banking-insurance"
  | "consulting"
  | "industry"
  | "aerospace-naval"
  | "energy"
  | "construction"
  | "retail"
  | "ecommerce"
  | "food-agri"
  | "health"
  | "logistics"
  | "public"
  | "education"
  | "media"
  | "tourism-hospitality"
  | "real-estate"
  | "automotive"
  | "telecom"
  | "nonprofit";

export const SECTORS: Record<SectorKey, { label: string; emoji: string }> = {
  tech: { label: "Tech & logiciels", emoji: "💻" },
  "digital-agency": { label: "Agences digitales & communication", emoji: "🎨" },
  "banking-insurance": { label: "Banque & assurance", emoji: "🏦" },
  consulting: { label: "Conseil & ESN", emoji: "🧭" },
  industry: { label: "Industrie & manufacturing", emoji: "🏭" },
  "aerospace-naval": { label: "Aéronautique & naval", emoji: "🚢" },
  energy: { label: "Énergie & environnement", emoji: "⚡" },
  construction: { label: "BTP & immobilier", emoji: "🏗️" },
  retail: { label: "Commerce & distribution", emoji: "🛒" },
  ecommerce: { label: "E-commerce", emoji: "📦" },
  "food-agri": { label: "Agroalimentaire", emoji: "🌾" },
  health: { label: "Santé & pharma", emoji: "🩺" },
  logistics: { label: "Transport & logistique", emoji: "🚚" },
  public: { label: "Secteur public & collectivités", emoji: "🏛️" },
  education: { label: "Éducation & formation", emoji: "🎓" },
  media: { label: "Médias & culture", emoji: "🎬" },
  "tourism-hospitality": { label: "Tourisme & hôtellerie", emoji: "🏨" },
  "real-estate": { label: "Immobilier", emoji: "🏠" },
  automotive: { label: "Automobile", emoji: "🚗" },
  telecom: { label: "Télécoms", emoji: "📡" },
  nonprofit: { label: "Associations & ESS", emoji: "🤝" },
};

export const SECTOR_KEYS = Object.keys(SECTORS) as SectorKey[];

// ─────────────────────────── MÉTIERS ────────────────────────────
export type JobFamilyKey =
  | "dev"
  | "data"
  | "cyber"
  | "infra"
  | "product"
  | "design"
  | "marketing"
  | "communication"
  | "sales"
  | "hr"
  | "finance"
  | "accounting"
  | "legal"
  | "logistics"
  | "industrial"
  | "quality"
  | "purchasing"
  | "admin"
  | "customer-support"
  | "project"
  | "health"
  | "retail-ops";

export const JOB_FAMILIES: Record<JobFamilyKey, { label: string; keywords: string[]; sectors: SectorKey[] }> = {
  dev: {
    label: "Développement & informatique",
    keywords: ["développeur", "developer", "dev", "web", "full stack", "fullstack", "front", "back", "logiciel", "software", "mobile", "sio", "informatique", "programmation", "react", "java", "php", "python", "javascript"],
    sectors: ["tech", "consulting", "digital-agency", "banking-insurance", "ecommerce"],
  },
  data: {
    label: "Data & IA",
    keywords: ["data", "données", "analyst", "analyste", "bi", "ia", "machine learning", "scientist", "engineer", "sql", "power bi"],
    sectors: ["tech", "consulting", "banking-insurance", "industry"],
  },
  cyber: {
    label: "Cybersécurité",
    keywords: ["cyber", "sécurité", "security", "soc", "pentest", "ssi", "rssi"],
    sectors: ["tech", "consulting", "banking-insurance", "telecom"],
  },
  infra: {
    label: "Systèmes, réseaux & cloud",
    keywords: ["système", "réseau", "infra", "cloud", "devops", "sysadmin", "administrateur", "support", "technicien", "sisr", "aws", "azure"],
    sectors: ["tech", "consulting", "telecom", "industry"],
  },
  product: {
    label: "Produit & gestion de projet digital",
    keywords: ["product", "produit", "po", "product owner", "scrum", "chef de projet", "amoa", "mobilité"],
    sectors: ["tech", "consulting", "digital-agency"],
  },
  design: {
    label: "Design & UX/UI",
    keywords: ["design", "ux", "ui", "graphiste", "graphique", "motion", "figma", "designer"],
    sectors: ["digital-agency", "tech", "media"],
  },
  marketing: {
    label: "Marketing digital",
    keywords: ["marketing", "seo", "sea", "growth", "community", "social media", "contenu", "content", "crm", "emailing", "acquisition"],
    sectors: ["digital-agency", "ecommerce", "retail", "tech", "tourism-hospitality"],
  },
  communication: {
    label: "Communication & événementiel",
    keywords: ["communication", "événementiel", "relations presse", "rédaction", "chargé de communication"],
    sectors: ["digital-agency", "media", "public", "nonprofit"],
  },
  sales: {
    label: "Commerce & business development",
    keywords: ["commerce", "commercial", "vente", "business developer", "sdr", "bdr", "négociation", "ndrc", "mco", "account", "technico"],
    sectors: ["retail", "tech", "banking-insurance", "industry", "real-estate", "automotive"],
  },
  hr: {
    label: "Ressources humaines",
    keywords: ["rh", "ressources humaines", "recrutement", "talent", "paie", "formation", "gestionnaire rh"],
    sectors: ["consulting", "industry", "retail", "public"],
  },
  finance: {
    label: "Finance & contrôle de gestion",
    keywords: ["finance", "contrôle de gestion", "contrôleur", "trésorerie", "analyste financier", "audit"],
    sectors: ["banking-insurance", "industry", "consulting"],
  },
  accounting: {
    label: "Comptabilité & gestion",
    keywords: ["comptable", "comptabilité", "gestion", "dcg", "dscg", "assistant de gestion", "pme"],
    sectors: ["banking-insurance", "consulting", "industry", "retail"],
  },
  legal: {
    label: "Juridique",
    keywords: ["juriste", "juridique", "droit", "compliance", "conformité"],
    sectors: ["banking-insurance", "consulting", "public"],
  },
  logistics: {
    label: "Logistique & supply chain",
    keywords: ["logistique", "supply", "approvisionnement", "transport", "entrepôt", "planification"],
    sectors: ["logistics", "industry", "retail", "ecommerce", "food-agri"],
  },
  industrial: {
    label: "Ingénierie & production industrielle",
    keywords: ["ingénieur", "production", "mécanique", "électrotechnique", "maintenance", "méthodes", "industrialisation", "automatisme", "robotique", "conception", "bureau d'études", "cao"],
    sectors: ["industry", "aerospace-naval", "energy", "automotive"],
  },
  quality: {
    label: "Qualité, sécurité & environnement",
    keywords: ["qualité", "qhse", "hse", "environnement", "sécurité au travail", "amélioration continue", "lean"],
    sectors: ["industry", "food-agri", "aerospace-naval", "health"],
  },
  purchasing: {
    label: "Achats",
    keywords: ["achats", "acheteur", "sourcing", "approvisionneur"],
    sectors: ["industry", "retail", "aerospace-naval"],
  },
  admin: {
    label: "Assistanat & administration",
    keywords: ["assistant", "administratif", "office", "secrétariat", "gestion administrative", "sam"],
    sectors: ["public", "consulting", "health", "real-estate"],
  },
  "customer-support": {
    label: "Relation client & support",
    keywords: ["relation client", "support", "service client", "conseiller", "customer", "chargé de clientèle"],
    sectors: ["telecom", "banking-insurance", "ecommerce", "retail"],
  },
  project: {
    label: "Gestion de projet & organisation",
    keywords: ["chef de projet", "coordination", "pmo", "planification", "organisation"],
    sectors: ["consulting", "construction", "energy", "public"],
  },
  health: {
    label: "Santé & social",
    keywords: ["santé", "soins", "pharmacie", "social", "médico"],
    sectors: ["health", "nonprofit", "public"],
  },
  "retail-ops": {
    label: "Vente en magasin & management",
    keywords: ["vendeur", "magasin", "manager", "rayon", "boutique", "mum", "mco"],
    sectors: ["retail", "food-agri", "ecommerce"],
  },
};

export const JOB_FAMILY_KEYS = Object.keys(JOB_FAMILIES) as JobFamilyKey[];

/** Devine la famille métier depuis un intitulé libre. */
export function guessJobFamily(input: string | null | undefined): JobFamilyKey | null {
  if (!input) return null;
  const text = input.toLowerCase();
  let best: { key: JobFamilyKey; score: number } | null = null;
  for (const key of JOB_FAMILY_KEYS) {
    const family = JOB_FAMILIES[key];
    let score = 0;
    for (const kw of family.keywords) {
      if (text.includes(kw)) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { key, score };
  }
  return best?.key ?? null;
}

// ────────────────────── NIVEAUX D'ÉTUDES ────────────────────────
export const EDUCATION_LEVELS: Record<EducationLevel, { label: string; short: string; rank: number; examples: string }> = {
  CAP: { label: "CAP / BEP", short: "CAP", rank: 0, examples: "CAP, BEP, titre pro niveau 3" },
  BAC: { label: "Bac", short: "Bac", rank: 1, examples: "Bac général, techno, pro" },
  BAC1: { label: "Bac+1", short: "Bac+1", rank: 2, examples: "1re année post-bac" },
  BAC2: { label: "Bac+2", short: "Bac+2", rank: 3, examples: "BTS, DUT, 2e année BUT" },
  BAC3: { label: "Bac+3", short: "Bac+3", rank: 4, examples: "Licence, BUT, Bachelor" },
  BAC4: { label: "Bac+4", short: "Bac+4", rank: 5, examples: "Master 1" },
  BAC5: { label: "Bac+5", short: "Bac+5", rank: 6, examples: "Master 2, ingénieur, école de commerce" },
};

export const EDUCATION_LEVEL_KEYS = Object.keys(EDUCATION_LEVELS) as EducationLevel[];

export function educationRank(level: EducationLevel | null | undefined): number | null {
  return level ? EDUCATION_LEVELS[level].rank : null;
}

export function educationLabel(level: EducationLevel | null | undefined): string {
  return level ? EDUCATION_LEVELS[level].short : "—";
}

export function educationRangeLabel(min?: EducationLevel | null, max?: EducationLevel | null): string {
  if (min && max && min !== max) return `${educationLabel(min)} → ${educationLabel(max)}`;
  if (min) return `${educationLabel(min)}${max ? "" : " et +"}`;
  if (max) return `Jusqu'à ${educationLabel(max)}`;
  return "Tous niveaux";
}

// ───────────────────────── CONTRATS ─────────────────────────────
export const CONTRACT_TYPES: Record<ContractType, { label: string; short: string }> = {
  APPRENTISSAGE: { label: "Contrat d'apprentissage", short: "Apprentissage" },
  PROFESSIONNALISATION: { label: "Contrat de professionnalisation", short: "Pro" },
};

export const DURATIONS = [6, 12, 24, 36] as const;

export const REMOTE_POLICIES: Record<RemotePolicy, { label: string; short: string }> = {
  NONE: { label: "Sur site", short: "Sur site" },
  HYBRID: { label: "Hybride", short: "Hybride" },
  FULL: { label: "Télétravail complet", short: "Full remote" },
};

export const WORK_RHYTHMS: Record<WorkRhythm, { label: string; short: string }> = {
  TWO_THREE: { label: "2 jours école / 3 jours entreprise", short: "2j / 3j" },
  THREE_TWO: { label: "3 jours école / 2 jours entreprise", short: "3j / 2j" },
  ONE_ONE_WEEK: { label: "1 semaine école / 1 semaine entreprise", short: "1 sem / 1 sem" },
  ONE_THREE_WEEK: { label: "1 semaine école / 3 semaines entreprise", short: "1 sem / 3 sem" },
  TWO_TWO_WEEK: { label: "2 semaines école / 2 semaines entreprise", short: "2 sem / 2 sem" },
  OTHER: { label: "Autre rythme", short: "Autre" },
};

export const COMPANY_SIZES: Record<CompanySize, { label: string; range: string }> = {
  TPE: { label: "TPE", range: "1 – 9 salariés" },
  PME: { label: "PME", range: "10 – 249 salariés" },
  ETI: { label: "ETI", range: "250 – 4 999 salariés" },
  GE: { label: "Grande entreprise", range: "5 000+ salariés" },
};

export const MOBILITIES: Record<Mobility, { label: string; description: string }> = {
  CITY: { label: "Ma ville", description: "Uniquement ma ville et ses alentours proches" },
  DEPARTMENT: { label: "Mon département", description: "Je peux me déplacer dans le département" },
  REGION: { label: "Ma région", description: "Je peux déménager dans la région" },
  NATIONAL: { label: "Toute la France", description: "Je suis mobile partout" },
};

export const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100] as const;

export const PUBLISHED_WITHIN_OPTIONS = [
  { value: "3h", label: "3 heures", hours: 3 },
  { value: "24h", label: "24 heures", hours: 24 },
  { value: "3d", label: "3 jours", hours: 72 },
  { value: "7d", label: "7 jours", hours: 168 },
  { value: "30d", label: "30 jours", hours: 720 },
] as const;

export type PublishedWithin = (typeof PUBLISHED_WITHIN_OPTIONS)[number]["value"];

// ─────────────────────── CANDIDATURES ───────────────────────────
export const APPLICATION_STATUSES: Record<
  ApplicationStatus,
  { label: string; short: string; tone: "muted" | "info" | "soft" | "warning" | "success" | "destructive"; order: number; hint: string }
> = {
  TO_REVIEW: { label: "À voir", short: "À voir", tone: "muted", order: 0, hint: "Offres repérées, à étudier" },
  TO_APPLY: { label: "À candidater", short: "À candidater", tone: "info", order: 1, hint: "Prêt à envoyer" },
  SENT: { label: "Envoyée", short: "Envoyée", tone: "soft", order: 2, hint: "Candidature envoyée" },
  TO_FOLLOW_UP: { label: "À relancer", short: "À relancer", tone: "warning", order: 3, hint: "Sans réponse depuis 7 jours" },
  INTERVIEW: { label: "Entretien", short: "Entretien", tone: "info", order: 4, hint: "Entretien planifié ou passé" },
  OFFER: { label: "Offre reçue", short: "Offre", tone: "success", order: 5, hint: "Proposition reçue" },
  REJECTED: { label: "Refus", short: "Refus", tone: "destructive", order: 6, hint: "Réponse négative" },
  ACCEPTED: { label: "Acceptée", short: "Acceptée", tone: "success", order: 7, hint: "Contrat signé 🎉" },
};

export const APPLICATION_STATUS_KEYS = (Object.keys(APPLICATION_STATUSES) as ApplicationStatus[]).sort(
  (a, b) => APPLICATION_STATUSES[a].order - APPLICATION_STATUSES[b].order,
);

export const FAVORITE_COLLECTIONS = {
  PRIORITY: { label: "Priorité", description: "Les offres à traiter en premier", emoji: "🔥" },
  TO_APPLY: { label: "À candidater", description: "Les offres pour lesquelles tu vas postuler", emoji: "✉️" },
  COMPANIES: { label: "Entreprises", description: "Les entreprises que tu veux contacter", emoji: "🏢" },
  WATCH: { label: "À surveiller", description: "Pour garder un œil dessus", emoji: "👀" },
} as const;

export const SEARCH_EXAMPLES = ["Développeur web", "BTS SIO", "Marketing", "Communication", "Commerce", "Cybersécurité"];

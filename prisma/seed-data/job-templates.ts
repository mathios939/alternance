import type { EducationLevel, RemotePolicy, WorkRhythm } from "../../src/generated/prisma/enums";

export type JobTemplate = {
  family: string;
  titles: string[];
  intro: string;
  missions: string[];
  requirements: string[];
  skills: string[];
  levelMin: EducationLevel;
  levelMax: EducationLevel;
  remote: RemotePolicy[];
  rhythms: WorkRhythm[];
  durations: number[];
  /** Salaire mensuel brut indicatif (alternance) */
  salary: [number, number];
};

const BENEFITS = [
  "Tickets restaurant",
  "Télétravail partiel",
  "Mutuelle prise en charge à 80 %",
  "Prime de fin d'année",
  "Remboursement 50 % transports",
  "Ordinateur portable fourni",
  "Tuteur dédié et point hebdomadaire",
  "Accès à la plateforme de formation interne",
  "Horaires flexibles",
  "Salle de sport",
  "Événements d'équipe",
  "Possibilité d'embauche à l'issue de l'alternance",
];

export function pickBenefits(rand: () => number, n = 4): string[] {
  const copy = [...BENEFITS];
  const out: string[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  return out;
}

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    family: "dev",
    titles: ["Développeur Full Stack — Alternance", "Développeur·se Web React / Node — Alternance", "Développeur Front-end — Alternance", "Développeur Back-end Java — Alternance", "Développeur PHP Symfony — Alternance", "Développeur mobile — Alternance"],
    intro: "Au sein de l'équipe produit, tu participes au développement de nos applications web et mobiles, de la conception à la mise en production, accompagné·e par un tuteur technique.",
    missions: [
      "Développer de nouvelles fonctionnalités en binôme avec un développeur senior",
      "Écrire des tests unitaires et participer aux revues de code",
      "Corriger les anomalies remontées par le support et les utilisateurs",
      "Participer aux rituels agiles (daily, sprint planning, rétrospective)",
      "Contribuer à la documentation technique",
    ],
    requirements: ["Formation en développement (BTS SIO, BUT Informatique, licence, école d'ingénieurs)", "Bases solides en JavaScript ou Java", "Curiosité et envie d'apprendre", "Anglais technique"],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["HYBRID", "HYBRID", "NONE"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK", "THREE_TWO"], durations: [12, 24, 24, 36], salary: [900, 1700],
  },
  {
    family: "dev",
    titles: ["Développeur .NET C# — Alternance", "Ingénieur logiciel C++ — Alternance", "Développeur Python — Alternance"],
    intro: "Tu rejoins une équipe R&D pour concevoir des composants logiciels robustes, avec un fort accent sur la qualité et les tests.",
    missions: ["Concevoir et développer des modules logiciels", "Automatiser les tests et l'intégration continue", "Analyser les performances et proposer des optimisations", "Participer aux revues de conception"],
    requirements: ["École d'ingénieurs ou master informatique", "Bonnes bases en algorithmique", "Rigueur"],
    skills: ["C#", ".NET", "Python", "C++", "Git", "CI/CD", "Tests logiciels"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID", "NONE"], rhythms: ["ONE_ONE_WEEK", "TWO_TWO_WEEK"], durations: [12, 24], salary: [1100, 1800],
  },
  {
    family: "data",
    titles: ["Data Analyst — Alternance", "Data Engineer — Alternance", "Alternance Data Scientist junior", "Alternant·e Business Intelligence"],
    intro: "Intégré·e à l'équipe data, tu transformes les données brutes en indicateurs utiles aux équipes métier et tu contribues à nos pipelines de données.",
    missions: ["Construire des tableaux de bord Power BI ou Looker", "Développer des scripts Python d'analyse et d'automatisation", "Fiabiliser les pipelines SQL et documenter les données", "Présenter les résultats aux équipes métier"],
    requirements: ["Formation data, statistiques ou informatique", "Maîtrise du SQL et bases de Python", "Esprit d'analyse et sens de la pédagogie"],
    skills: ["SQL", "Python", "Power BI", "Pandas", "Data Analysis", "Excel"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [1000, 1750],
  },
  {
    family: "cyber",
    titles: ["Analyste SOC — Alternance", "Alternant·e cybersécurité", "Pentester junior — Alternance", "Alternance Sécurité des systèmes d'information"],
    intro: "Au sein de l'équipe sécurité, tu participes à la surveillance, à l'analyse des incidents et à l'amélioration continue de notre posture de sécurité.",
    missions: ["Analyser les alertes du SIEM et qualifier les incidents", "Participer aux audits et tests d'intrusion", "Rédiger des procédures et sensibiliser les utilisateurs", "Suivre les vulnérabilités et les correctifs"],
    requirements: ["Formation cybersécurité ou réseaux (licence, master, école)", "Connaissances Linux et réseaux", "Rigueur, discrétion, esprit d'analyse"],
    skills: ["Cybersécurité", "Linux", "Réseaux", "SIEM", "Python", "ISO 27001"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID", "NONE"], rhythms: ["ONE_ONE_WEEK", "TWO_THREE"], durations: [12, 24], salary: [1000, 1800],
  },
  {
    family: "infra",
    titles: ["Technicien systèmes et réseaux — Alternance", "Alternance Administrateur systèmes", "Alternant·e DevOps / Cloud", "Technicien support informatique — Alternance"],
    intro: "Tu accompagnes l'équipe IT dans l'exploitation de l'infrastructure, le support aux utilisateurs et les projets de modernisation.",
    missions: ["Assurer le support de niveau 1 et 2", "Administrer les serveurs Windows et Linux", "Automatiser les déploiements et la supervision", "Participer aux projets cloud et sécurité"],
    requirements: ["BTS SIO SISR, BUT Réseaux ou licence pro", "Bases Windows, Linux et réseaux", "Sens du service"],
    skills: ["Linux", "Windows Server", "Réseaux", "Active Directory", "Support utilisateur", "Docker", "Office 365"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [850, 1600],
  },
  {
    family: "product",
    titles: ["Product Owner junior — Alternance", "Chef·fe de projet digital — Alternance", "Alternance Assistant·e chef de projet IT"],
    intro: "Tu accompagnes l'équipe produit dans la définition, la priorisation et le suivi des fonctionnalités, en lien direct avec les utilisateurs.",
    missions: ["Rédiger les user stories et maintenir le backlog", "Organiser les ateliers avec les utilisateurs", "Suivre la recette et les mises en production", "Analyser les usages et proposer des améliorations"],
    requirements: ["Master ou école (informatique, gestion de projet, digital)", "Aisance rédactionnelle et relationnelle", "Curiosité produit"],
    skills: ["Product Management", "Agile", "Jira", "UX Research", "Gestion de projet", "Figma"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [1000, 1700],
  },
  {
    family: "design",
    titles: ["UX/UI Designer — Alternance", "Graphiste — Alternance", "Alternance Motion designer"],
    intro: "Au sein du studio, tu conçois des interfaces et des supports visuels cohérents avec notre identité de marque.",
    missions: ["Réaliser wireframes, maquettes et prototypes", "Décliner l'identité visuelle sur print et digital", "Participer aux tests utilisateurs", "Alimenter le design system"],
    requirements: ["Formation design, école d'art ou bachelor UX", "Maîtrise de Figma et de la suite Adobe", "Portfolio à joindre"],
    skills: ["Figma", "UX/UI Design", "Adobe Photoshop", "Adobe Illustrator", "Design graphique"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["HYBRID", "NONE"], rhythms: ["TWO_THREE", "THREE_TWO"], durations: [12, 24], salary: [850, 1500],
  },
  {
    family: "marketing",
    titles: ["Chargé·e de marketing digital — Alternance", "Alternance Community manager", "Alternant·e SEO / Content", "Assistant·e marketing — Alternance", "Alternance Growth marketing"],
    intro: "Tu participes à la stratégie d'acquisition et de contenu : réseaux sociaux, SEO, campagnes et analyse des performances.",
    missions: ["Animer les réseaux sociaux et produire des contenus", "Optimiser le référencement naturel du site", "Piloter des campagnes emailing et publicitaires", "Analyser les résultats et proposer des actions"],
    requirements: ["BTS, BUT, licence ou master marketing / communication", "Excellent rédactionnel", "Créativité et sens de l'analyse"],
    skills: ["SEO", "Social media", "Content marketing", "Google Analytics", "Emailing", "Canva"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["HYBRID", "NONE"], rhythms: ["TWO_THREE", "THREE_TWO", "ONE_ONE_WEEK"], durations: [12, 24], salary: [800, 1500],
  },
  {
    family: "communication",
    titles: ["Chargé·e de communication — Alternance", "Alternance Communication interne", "Assistant·e communication & événementiel — Alternance"],
    intro: "Tu contribues à la communication interne et externe : contenus, événements, relations presse et supports.",
    missions: ["Rédiger newsletters, articles et communiqués", "Organiser des événements internes et salons", "Gérer les supports print et digitaux", "Suivre les prestataires"],
    requirements: ["Formation communication (BTS, licence, master)", "Orthographe irréprochable", "Organisation et créativité"],
    skills: ["Communication", "Rédaction", "Événementiel", "Canva", "Social media"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "THREE_TWO"], durations: [12, 24], salary: [800, 1450],
  },
  {
    family: "sales",
    titles: ["Business Developer — Alternance", "Commercial·e B2B — Alternance", "Alternance Assistant·e commercial", "Chargé·e d'affaires junior — Alternance", "Alternance SDR / prospection"],
    intro: "Tu participes au développement commercial : prospection, qualification des besoins, rendez-vous et suivi client, avec un objectif clair et un accompagnement quotidien.",
    missions: ["Prospecter par téléphone, email et LinkedIn", "Qualifier les besoins et préparer les propositions", "Participer aux rendez-vous clients", "Mettre à jour le CRM et suivre le pipeline"],
    requirements: ["BTS NDRC / MCO, BUT TC, licence ou école de commerce", "Aisance relationnelle et goût du challenge", "Permis B apprécié"],
    skills: ["Prospection", "Négociation", "Vente", "CRM", "Relation client"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [850, 1600],
  },
  {
    family: "hr",
    titles: ["Assistant·e RH — Alternance", "Chargé·e de recrutement — Alternance", "Alternance Gestionnaire paie et administration du personnel"],
    intro: "Au sein de l'équipe RH, tu accompagnes le recrutement, l'intégration et la gestion administrative des collaborateurs.",
    missions: ["Diffuser les annonces et présélectionner les candidatures", "Organiser les entretiens et l'onboarding", "Préparer les éléments de paie et les contrats", "Contribuer aux projets RH (marque employeur, formation)"],
    requirements: ["Licence ou master RH", "Discrétion et rigueur", "Bon relationnel"],
    skills: ["Recrutement", "Administration du personnel", "SIRH", "Pack Office", "Droit du travail"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [900, 1550],
  },
  {
    family: "finance",
    titles: ["Contrôleur·se de gestion junior — Alternance", "Alternance Analyste financier", "Assistant·e contrôle de gestion — Alternance"],
    intro: "Rattaché·e à la direction financière, tu participes au reporting, aux clôtures et à l'analyse des écarts.",
    missions: ["Préparer les reportings mensuels", "Analyser les écarts budget / réel", "Participer aux clôtures et au budget", "Automatiser les tableaux de bord"],
    requirements: ["Master finance / contrôle de gestion, école de commerce", "Excel avancé", "Rigueur et esprit de synthèse"],
    skills: ["Contrôle de gestion", "Excel", "Analyse financière", "Power BI", "SAP"],
    levelMin: "BAC4", levelMax: "BAC5", remote: ["HYBRID"], rhythms: ["ONE_ONE_WEEK", "TWO_THREE"], durations: [12, 24], salary: [1100, 1800],
  },
  {
    family: "accounting",
    titles: ["Assistant·e comptable — Alternance", "Alternance Comptable général", "Assistant·e de gestion PME — Alternance"],
    intro: "Tu participes à la tenue comptable, à la facturation et au suivi administratif, au sein d'une équipe à taille humaine.",
    missions: ["Saisir les factures fournisseurs et clients", "Effectuer les rapprochements bancaires", "Préparer les déclarations de TVA", "Participer aux clôtures"],
    requirements: ["BTS CG, DCG ou BUT GEA", "Rigueur et organisation", "Maîtrise d'Excel"],
    skills: ["Comptabilité générale", "Facturation", "Sage", "Excel", "Fiscalité"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "THREE_TWO"], durations: [12, 24], salary: [850, 1500],
  },
  {
    family: "legal",
    titles: ["Juriste junior — Alternance", "Alternance Chargé·e de conformité"],
    intro: "Au sein de la direction juridique, tu participes à la rédaction et au suivi des contrats et à la veille réglementaire.",
    missions: ["Rédiger et relire des contrats", "Assurer la veille juridique", "Participer aux dossiers de conformité (RGPD, LCB-FT)", "Préparer des notes de synthèse"],
    requirements: ["Master droit des affaires ou conformité", "Qualités rédactionnelles", "Rigueur"],
    skills: ["Droit des affaires", "Conformité", "RGPD", "Rédaction"],
    levelMin: "BAC4", levelMax: "BAC5", remote: ["HYBRID"], rhythms: ["ONE_ONE_WEEK"], durations: [12, 24], salary: [1100, 1800],
  },
  {
    family: "logistics",
    titles: ["Assistant·e supply chain — Alternance", "Alternance Approvisionneur·se", "Chargé·e de planification logistique — Alternance", "Alternant·e Gestion des flux"],
    intro: "Tu accompagnes l'équipe supply chain dans la planification, l'approvisionnement et l'optimisation des flux.",
    missions: ["Suivre les approvisionnements et les stocks", "Planifier la production ou les expéditions", "Analyser les indicateurs logistiques", "Participer aux projets d'amélioration continue"],
    requirements: ["BUT GLT, licence pro ou master supply chain", "Aisance avec Excel et un ERP", "Réactivité"],
    skills: ["Supply chain", "ERP", "Excel", "Gestion des stocks", "Lean management"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK", "TWO_TWO_WEEK"], durations: [12, 24], salary: [900, 1600],
  },
  {
    family: "industrial",
    titles: ["Ingénieur·e méthodes — Alternance", "Alternance Technicien·ne bureau d'études", "Ingénieur·e production — Alternance", "Alternant·e Automaticien", "Technicien·ne maintenance industrielle — Alternance", "Ingénieur·e conception mécanique — Alternance"],
    intro: "Tu intègres une équipe d'ingénierie industrielle pour contribuer à la conception, l'industrialisation et l'amélioration de nos produits et process.",
    missions: ["Réaliser des études et modélisations CAO", "Optimiser les process de production", "Participer à la mise en service d'équipements", "Rédiger les dossiers techniques"],
    requirements: ["École d'ingénieurs, BUT GMP / GEII ou licence pro", "Maîtrise d'un logiciel de CAO", "Esprit d'équipe et rigueur"],
    skills: ["CAO", "Mécanique", "Automatisme", "Lean management", "Méthodes industrialisation", "Maintenance industrielle"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE"], rhythms: ["ONE_ONE_WEEK", "TWO_TWO_WEEK", "TWO_THREE"], durations: [12, 24, 36], salary: [950, 1800],
  },
  {
    family: "quality",
    titles: ["Alternance Qualité / QHSE", "Technicien·ne qualité — Alternance", "Alternant·e Amélioration continue", "Chargé·e HSE — Alternance"],
    intro: "Au sein du service qualité, tu contribues au système de management de la qualité, aux audits et à la prévention des risques.",
    missions: ["Traiter les non-conformités et animer les 8D", "Préparer et suivre les audits", "Mettre à jour la documentation qualité", "Animer des chantiers d'amélioration continue"],
    requirements: ["Licence pro ou master QHSE / qualité", "Connaissance ISO 9001", "Sens de l'organisation"],
    skills: ["Qualité", "Lean management", "Excel", "Audit"],
    levelMin: "BAC2", levelMax: "BAC5", remote: ["NONE"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [900, 1650],
  },
  {
    family: "purchasing",
    titles: ["Acheteur·se junior — Alternance", "Alternance Assistant·e achats"],
    intro: "Tu accompagnes l'équipe achats dans la consultation des fournisseurs, la négociation et le suivi des contrats.",
    missions: ["Consulter et comparer les fournisseurs", "Préparer les négociations", "Suivre les commandes et les litiges", "Mettre à jour les indicateurs achats"],
    requirements: ["Master achats ou école de commerce", "Anglais professionnel", "Négociation"],
    skills: ["Achats", "Négociation", "Excel", "SAP", "Anglais"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID", "NONE"], rhythms: ["ONE_ONE_WEEK", "TWO_THREE"], durations: [12, 24], salary: [1000, 1700],
  },
  {
    family: "admin",
    titles: ["Assistant·e administratif·ve — Alternance", "Alternance Assistant·e de direction", "Alternance Office manager"],
    intro: "Tu assures le soutien administratif de l'équipe : gestion des dossiers, accueil, courrier, organisation des déplacements et réunions.",
    missions: ["Gérer l'accueil téléphonique et physique", "Traiter le courrier et les dossiers administratifs", "Organiser réunions et déplacements", "Mettre à jour les tableaux de suivi"],
    requirements: ["BTS SAM / GPME", "Maîtrise du Pack Office", "Organisation et discrétion"],
    skills: ["Gestion administrative", "Pack Office", "Rédaction"],
    levelMin: "BAC", levelMax: "BAC3", remote: ["NONE"], rhythms: ["TWO_THREE", "THREE_TWO"], durations: [12, 24], salary: [800, 1400],
  },
  {
    family: "customer-support",
    titles: ["Conseiller·ère clientèle — Alternance", "Chargé·e de relation client — Alternance", "Alternance Gestionnaire de contrats", "Customer Success junior — Alternance"],
    intro: "Tu accompagnes nos clients au quotidien : réponses aux demandes, suivi des dossiers et contribution à l'amélioration de l'expérience client.",
    missions: ["Répondre aux demandes clients par téléphone, email et chat", "Gérer les dossiers et réclamations", "Remonter les irritants aux équipes produit", "Participer aux actions de fidélisation"],
    requirements: ["BTS, BUT ou licence (commerce, banque, assurance, relation client)", "Écoute et sens du service", "Bonne expression orale et écrite"],
    skills: ["Relation client", "CRM", "Pack Office", "Communication orale"],
    levelMin: "BAC", levelMax: "BAC3", remote: ["NONE", "HYBRID"], rhythms: ["TWO_THREE", "ONE_ONE_WEEK"], durations: [12, 24], salary: [800, 1450],
  },
  {
    family: "project",
    titles: ["Assistant·e chef·fe de projet — Alternance", "Alternance PMO junior", "Chef·fe de projet junior — Alternance"],
    intro: "Tu accompagnes les chefs de projet dans le pilotage : planning, suivi des risques, coordination des équipes et reporting.",
    missions: ["Mettre à jour les plannings et suivre les jalons", "Préparer les comités de pilotage", "Coordonner les parties prenantes", "Formaliser les processus"],
    requirements: ["Master gestion de projet, école d'ingénieurs ou de commerce", "Organisation et communication", "Maîtrise des outils bureautiques"],
    skills: ["Gestion de projet", "Agile", "Jira", "Pack Office"],
    levelMin: "BAC3", levelMax: "BAC5", remote: ["HYBRID"], rhythms: ["ONE_ONE_WEEK", "TWO_THREE"], durations: [12, 24], salary: [1000, 1700],
  },
  {
    family: "retail-ops",
    titles: ["Vendeur·se conseil — Alternance", "Alternance Manager de rayon", "Adjoint·e responsable de magasin — Alternance"],
    intro: "En magasin, tu participes à l'accueil et au conseil des clients, à la mise en rayon et à l'animation commerciale.",
    missions: ["Accueillir et conseiller les clients", "Gérer les stocks et la mise en rayon", "Participer aux animations commerciales", "Suivre les indicateurs de vente"],
    requirements: ["Bac pro, BTS MCO ou licence commerce", "Sens du contact", "Dynamisme"],
    skills: ["Vente", "Merchandising", "Relation client", "Gestion des stocks"],
    levelMin: "BAC", levelMax: "BAC3", remote: ["NONE"], rhythms: ["TWO_THREE", "THREE_TWO"], durations: [12, 24], salary: [800, 1400],
  },
];

export function templatesFor(family: string): JobTemplate[] {
  return JOB_TEMPLATES.filter((t) => t.family === family);
}

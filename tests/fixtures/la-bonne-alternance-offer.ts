/** Offre de l'API Alternance (schéma OpenAPI `JobOfferRead`, identique dans l'export). Données fictives. */
export const LBA_OFFER_FIXTURE = {
  identifier: {
    partner_job_id: "b16a546a-e61f-4028-b5a3-1a7bbfaa4e3d",
    id: "6687165396d52b5e01b409545",
    partner_label: "offres_emploi_lba",
  },
  workplace: {
    name: "ATLANTIC SOFTWARE",
    description: "Éditeur de logiciels nantais.",
    website: "https://www.atlantic-software.example",
    siret: "13002526500013",
    location: {
      address: "12 RUE DE LA FOSSE 44000 NANTES",
      geopoint: { type: "Point", coordinates: [-1.553621, 47.218371] },
    },
    brand: null,
    legal_name: "ATLANTIC SOFTWARE SAS",
    size: "20-49",
    domain: {
      idcc: 1486,
      opco: "ATLAS",
      naf: { code: "62.01Z", label: "Programmation informatique" },
    },
  },
  apply: {
    phone: null,
    url: "https://labonnealternance.apprentissage.beta.gouv.fr/emploi/offres_emploi_lba/6687165396d52b5e01b409545/atlantic-software",
    recipient_id: "6687165396d52b5e01b409545",
  },
  contract: {
    start: "2026-10-01T00:00:00.000Z",
    duration: 24,
    type: ["Apprentissage"],
    remote: "hybrid",
  },
  offer: {
    title: "Développeur / Développeuse web en alternance",
    rome_codes: ["M1805"],
    description:
      "Dans le cadre d'un contrat d'apprentissage de 24 mois, vous rejoignez notre équipe produit à Nantes pour concevoir des interfaces React et des API Node.js. Vous participez aux revues de code, aux tests automatisés et au déploiement continu.",
    target_diploma: { european: "6", label: "Licence, Bachelor, BUT (niveau 6)" },
    desired_skills: ["Faire preuve de rigueur et de précision", "Travailler en équipe"],
    to_be_acquired_skills: ["Concevoir et développer une solution digitale"],
    access_conditions: [
      "Ce métier est accessible avec un diplôme de niveau Bac+2 à Bac+5 en informatique.",
    ],
    opening_count: 2,
    publication: { creation: "2026-09-01T08:15:00.000Z", expiration: "2026-11-30T23:59:59.000Z" },
    status: "Active",
  },
};

/** Offre relayée depuis France Travail (déjà ingérée à la source : ignorée par le provider). */
export const LBA_OFFER_FRANCE_TRAVAIL = {
  ...LBA_OFFER_FIXTURE,
  identifier: { partner_job_id: "195ABCD", id: null, partner_label: "France Travail" },
  apply: {
    phone: null,
    url: "https://candidat.francetravail.fr/offres/recherche/detail/195ABCD",
    recipient_id: null,
  },
};

/** Offre d'un partenaire, à Rennes, sans description ni coordonnées. */
export const LBA_OFFER_PARTNER_MINIMAL = {
  identifier: {
    partner_job_id: "hw-4242",
    id: "77a1165396d52b5e01b40aaaa",
    partner_label: "Hellowork",
  },
  workplace: {
    name: null,
    description: null,
    website: null,
    siret: null,
    location: { address: "35000 RENNES", geopoint: null },
    brand: "BRETAGNE BÂTIMENT",
    legal_name: null,
    size: null,
    domain: { idcc: null, opco: null, naf: null },
  },
  apply: {
    phone: "0299000000",
    url: "https://www.hellowork.example/offre/4242",
    recipient_id: null,
  },
  contract: { start: null, duration: null, type: ["Professionnalisation"], remote: null },
  offer: {
    title: "Chargé d'affaires bâtiment en alternance",
    rome_codes: [],
    description: "",
    target_diploma: null,
    desired_skills: [],
    to_be_acquired_skills: [],
    access_conditions: [],
    opening_count: 1,
    publication: { creation: "2026-09-08T10:00:00.000Z", expiration: null },
    status: "Active",
  },
};

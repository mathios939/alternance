# Fournisseurs externes

Toutes les intégrations passent par une interface, se déclarent explicitement (capabilities, statut, variables manquantes) et **n'imitent jamais** une source absente. Une clé manquante produit un statut « non configuré » avec la variable exacte à renseigner ; jamais un repli silencieux.

## Sources d'offres (`src/services/job-sources`)

Contrat `JobSourceProvider` : `key`, `name`, `type`, `priority` (source canonique de candidature), `capabilities` (`supportsSearch`, `supportsIncrementalSync`, `supportsLocation`, `supportsRadius`, `supportsDetails`, `supportsSalary`, `supportsExpiration`, `supportsVerification`), `status()`, `fetchJobs(params)`, `verifyJobs?(ids)`.

| Provider | Clé | Priorité | Statut | Ce qu'il fait |
|---|---|---|---|---|
| `FranceTravailProvider` | `france-travail` | 70 | réel, nécessite `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` | API officielle « Offres d'emploi v2 » : OAuth2 client_credentials (jeton renouvelé 60 s avant expiration), recherche par mots-clés / commune INSEE + rayon / département / région, fenêtre `[minCreationDate, maxCreationDate]` ou `publieeDepuis`, filtre nature de contrat alternance (codes lus dans le référentiel, repli `E2,FS`, découpe possible par nature), pagination `range` + `Content-Range` (150 par page, borne API 3 150, troncature signalée), 204 / 400 / 401 (renouvellement) / 404 / 429 (`Retry-After` → pause globale du quota manager) / 5xx (backoff), timeouts (15 s), **quota manager** (`src/services/job-sources/quota.ts` : débit `FRANCE_TRAVAIL_MAX_RPS` = 3/s par défaut, concurrence 2, file par priorité live > récent > vérification > rattrapage, compteur partagé par minute en base), détail d'offre pour la vérification des retraits. Un lieu au niveau région (« 52 - Pays de la Loire », « 44 - Grand Est ») n'est jamais lu comme un département. |
| `CompanyCareerProvider` | `company-career` | 90 | flux JSON Feed / RSS déclarés dans `CAREER_FEEDS_JSON` | Sites carrières fournis volontairement (jamais de crawl HTML). |
| `ManualProvider` | `manual` | 50 | toujours | Offres saisies / injectées (tests, démonstration). |

### France Travail : obtenir des identifiants

1. Créer un compte sur <https://francetravail.io>, déclarer une application.
2. Souscrire à l'API « Offres d'emploi v2 » (scope `api_offresdemploiv2 o2dsoffre`).
3. Renseigner `FRANCE_TRAVAIL_CLIENT_ID` et `FRANCE_TRAVAIL_CLIENT_SECRET` dans `.env` (serveur uniquement).
4. Vérifier de bout en bout : `npm run test:france-travail -- --q developpeur --city Nantes --radius 30`.

Le test externe contrôle dans l'ordre : configuration → authentification → référentiels (codes alternance, codes INSEE de `src/config/cities.ts`) → recherche paginée → validation & normalisation → stockage → dédoublonnage (seconde exécution) → vérification d'existence. Il échoue proprement (code 2) sans identifiants.

### Mapping France Travail → modèle interne

`ftOfferSchema` (Zod, tolérant) puis `mapFtOffer` : titre, description, `lieuTravail` (libellé « 44 - NANTES » → ville, code postal, code INSEE, coordonnées, département / région via `src/config/departments.ts`), `entreprise` (nom, site, logo, description), nature de contrat → `APPRENTISSAGE` / `PROFESSIONNALISATION`, `formations[].niveauLibelle` → niveau min / max, `typeContratLibelle` → durée, `salaire.libelle` → min / max / période (rien si « selon profil »), `competences`, `qualitesProfessionnelles`, `contact` (URL de postulation, e-mail publié, libellé du contact), `origineOffre` (lien partenaire), ROME, NAF, nombre de postes. Ce que la source ne fournit pas reste `null` (télétravail → `UNKNOWN`).

## Pipeline d'ingestion (`src/services/ingestion`)

`SOURCE → FETCH → VALIDATION → NORMALIZATION → DEDUPLICATION → ENRICHMENT → DATABASE`, journalisé dans `IngestionRun` (compteurs récupérées / créées / mises à jour / doublons / rejetées / erreurs, durée, résumé d'erreur).

À l'échelle nationale (`docs/SYNC.md`) : entrées existantes retrouvées par lot (une requête pour 500 identifiants), offres dont la source n'a pas changé `dateActualisation` seulement pointées (`lastSeenAt`, `lastVerifiedAt`, `missedListings = 0`) sans réécriture, rapprochements d'entreprise mémorisés pendant l'exécution, index de dédoublonnage restreint aux départements du lot. La synchronisation nationale (`national-sync.ts`) enchaîne les territoires avec points de reprise, découpe des fenêtres tronquées et réconciliation des offres disparues des listages.

- **Validation** (`validate.ts`) : identifiant, titre ≥ 3, description ≥ 40, localisation (ville ou coordonnées), date valide (≤ 365 jours, pas future), alternance déclarée ou mentionnée.
- **Normalisation** (`job-sources/normalize.ts`) : titre normalisé, entreprise normalisée, famille métier, compétences, niveau / rythme / télétravail déduits du texte uniquement.
- **Dédoublonnage** (`job-sources/dedupe.ts`) : `calculateDuplicateConfidence` 0-1 (identifiant externe, URL canonique, entreprise, titre, ville / code postal, description, dates). ≥ 0,92 → rattachement à l'offre canonique comme `JobSourceEntry` (l'utilisateur ne voit qu'une offre, toutes les sources sont conservées, la candidature pointe vers la source la plus prioritaire) ; 0,75 – 0,92 → créée mais masquée (`canonicalJobId`) et listée en admin ; < 0,75 → distincte.
- **Enrichissement** : rapprochement entreprise (`company-match.ts` : SIREN, nom normalisé, similarité trigramme, sinon création avec provenance ; employeur non communiqué → fiche technique jamais listée), compétences, score de qualité (`quality.ts`), contact publié dans l'offre (`contacts.ts`, uniquement si le libellé désigne une personne).
- **Vérification** (`verify.ts`) : re-contrôle auprès de la source (`verifyJobs`), entrée `REMOVED` si retirée, offre retirée si plus aucune source active.
- **Expiration** (`expire.ts`) : `expiresAt` dépassé, non re-vérifiée depuis 14 j → `UNKNOWN`, 45 j → `EXPIRED`, publiée depuis > 120 j → `EXPIRED`. Les offres de démonstration ne sont jamais touchées.

Commandes : `npm run jobs:sync:national`, `jobs:sync`, `jobs:verify`, `jobs:expire`, `companies:import`, `db:coverage` ; routes HTTP équivalentes `/api/cron/{sync,verify,expire,companies}` protégées par `CRON_SECRET` (la planification par défaut est le workflow GitHub Actions « Production sync », toutes les deux heures).

### Sources candidates (légalement exploitables uniquement)

France Travail est la première source, pas la seule. Le registre accepte tout provider respectant le contrat ; aucune source n'est activée tant qu'elle n'a pas été validée de bout en bout sur des données réelles (statut « non configuré » explicite, jamais de simulation).

| Source | Nature | Statut | Ce qu'il faut |
|---|---|---|---|
| France Travail — Offres d'emploi v2 | API officielle | **active** | identifiants partenaire (déjà en place) |
| La bonne alternance (API Alternance, Ministère du Travail — `api.apprentissage.beta.gouv.fr`) | API officielle, offres déposées par les entreprises + partenaires ; licence ouverte | candidate, non intégrée | clé d'API gratuite à demander sur le portail, puis validation `tests/external` avant activation |
| Sites carrières fournis volontairement (JSON Feed / RSS) | flux autorisé | disponible (`CompanyCareerProvider`, `CAREER_FEEDS_JSON`) | URL de flux communiquée par l'entreprise |
| ATS à endpoint public documenté (Welcome to the Jungle, Greenhouse, Lever, Teamtailor, SmartRecruiters…) | API publique par entreprise, CGU à respecter au cas par cas | à étudier par entreprise | identifiant d'entreprise sur l'ATS, vérification des conditions d'utilisation |
| Partenaires (écoles, CFA, OPCO) et dépôt direct par les entreprises | flux convenu / saisie | à convenir (`ManualProvider`, `PARTNER`) | convention de partage |

Jamais de scraping de sites en violation de leurs CGU (Indeed, LinkedIn, HelloWork, Jobteaser…).

## Données d'entreprises (`src/services/company-data`)

Contrat `CompanyDataProvider` (`search`, `getBySiren`, capabilities). Implémentation : `RechercheEntreprisesProvider` — API Recherche d'entreprises (open data SIRENE / RNE, sans clé, 7 req/s). Fiches : raison sociale, sigle, SIREN / SIRET du siège, NAF (→ secteur et familles de métiers via `naf.ts`), tranche d'effectif (→ taille `REAL`), adresse, commune, coordonnées, catégorie PME / ETI / GE. Les sites web et descriptions ne sont **pas** fournis : ils restent vides. Import ciblé par département et codes NAF (`npm run companies:import`, départements prioritaires Pays de la Loire + Bretagne). Test réseau : `npm run test:companies`.

## Contacts (`src/services/ingestion/contacts.ts`)

Seule source : le bloc « contact » publié par l'annonceur dans une offre officielle. Un contact nominatif est créé uniquement si le libellé désigne clairement une personne (civilité ou prénom / nom, sans mot d'organisation, différent du nom de l'entreprise). Champs de provenance : `source = JOB_POSTING`, `sourceUrl`, `publiclyAvailable`, `professionalContext`, `verifiedAt`, `confidenceScore`. Droit d'opposition : `optOutAt` (jamais recréé). Sans contact : `recommendContactRole` propose la fonction à viser (RH / Talent Acquisition, manager, dirigeant) et les canaux officiels connus. Aucun profil LinkedIn collecté, aucun e-mail deviné.

## IA (`src/lib/ai`)

`AIProvider` (`generate`, `stream`, `isConfigured`). Résolution (`resolveAIProvider`) :

| `AI_PROVIDER` | Clé | Résultat |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | `AnthropicProvider` (`claude-opus-5`, `output_config.effort`) |
| `openai` | `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`) | `OpenAICompatibleProvider` |
| `anthropic` / `openai` sans clé | — | `UnavailableAIProvider` : « Fonctionnalité IA indisponible : provider non configuré. » |
| `mock` | — | `MockProvider` (réponses construites par règles, toujours signalées « mode démo ») |
| absent | — | mock en développement / test, **indisponible en production** |

Test réel : `npm run test:ai-provider` (requête simple, streaming, clé invalide → erreur typée, annulation). Aucune donnée personnelle superflue n'est envoyée : le contexte est construit champ par champ (`context.ts`).

## Recherche (`src/lib/search`)

`PostgresSearchProvider` : configuration `french_unaccent` (extension `unaccent` + stemmer français), synonymes métier (`synonyms.ts` : développeur / developpeur / developer / dev…), préfixes, requête stricte puis élargie, ILIKE sans accents sur titre et compétences. Exclut les offres expirées / retirées et, si `DEMO_MODE=false`, la démonstration.

## Géolocalisation et trajets

Coordonnées stockées sur offres et entreprises (source ou ville connue). Rayon : boîte englobante SQL puis Haversine exact ; une ville sans rayon explicite applique un rayon par défaut de 15 km (jamais une simple égalité de chaînes). Temps de trajet : `HeuristicTravelTimeProvider` (vol d'oiseau + vitesse moyenne, qualité « estimated ») ou `OsrmTravelTimeProvider` (`TRAVEL_TIME_PROVIDER=osrm`, qualité « routed »). L'instance publique OSRM est un service de démonstration sans garantie : hébergez la vôtre (`OSRM_BASE_URL`). Test : `npm run test:osrm`.

## Authentification

better-auth : e-mail / mot de passe ; Google et Microsoft affichés uniquement si leurs identifiants sont configurés.

## Email

`RESEND_API_KEY` réservé ; aucun envoi automatique n'est implémenté (les relances ne sont jamais envoyées sans action explicite).

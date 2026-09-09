# Modèle de données

Schéma complet : `prisma/schema.prisma`. Toutes les tables sont en snake_case (`@@map`). Les données de démonstration portent `isDemo = true` et `dataOrigin = DEMO`.

## Compte & profil

- **User** — compte (better-auth) + `role` (USER/ADMIN), `plan` (FREE/PREMIUM), consentements, `onboardingCompletedAt`.
- **Session / Account / Verification** — tables better-auth.
- **CandidateProfile** — 1:1 avec User : métier, famille, formation, école, localisation (domicile + école, géocodées), mobilité, rayon, permis/véhicule, télétravail, contrat souhaité (date, durée, rythme, types), secteurs, bio, objectif hebdo, streak, mode urgence, `completionScore`.
- **Education / Experience / Project / Language** — sections du profil.
- **Skill / UserSkill** — référentiel de compétences (slug, catégorie, alias) et niveau par candidat.

## CV

- **Resume** — version nommée (« CV Développement »), `isDefault`.
- **ResumeVersion** — fichier (bytes, MIME, taille), texte extrait, contenu structuré, analyse (JSON `ResumeAnalysis`).

## Entreprises & contacts

- **Company** — identité, secteur, taille, effectif, sites, localisation géocodée, technologies, métiers recrutés, `hiresApprentices`, `apprenticeCountEstimate`, `isHiring`, `lastActivityAt`, provenance.
- **CompanyLocation** — implantations (siège + sites).
- **Contact** — informations professionnelles publiques uniquement : poste, LinkedIn/email si publics, source, `verifiedAt`, `confidenceScore`, `optOutAt` (droit d'opposition), provenance.

## Offres

- **Job** — format interne unique (titre, description, missions, exigences, avantages, compétences, localisation, contrat, niveaux, durée, rythme, salaire, télétravail, dates, source, URLs, `isActive`, provenance, `viewCount`). Déduplication : `canonicalJobId` + `duplicateConfidence`.
- **JobSkill** — compétences normalisées (requises/optionnelles).
- **JobSource / JobSourceEntry** — sources (statut de synchro) et rattachement d'une offre à chaque source (`externalId`, URL, payload brut).

## Candidatures

- **Application** — par utilisateur : offre ou entreprise (spontanée), statut (machine à états), dates, contact, CV, lettre, notes, prochaine action, relances (`lastFollowUpAt`, `followUpCount`, `followUpSnoozedUntil`), canal, position Kanban, `matchScore` au moment de l'ajout.
- **ApplicationEvent** — historique (création, changement de statut, note, relance, report, entretien, document, archivage).
- **GeneratedDocument** — lettres, emails, messages, relances, préparations (fournisseur, modèle, provenance `AI_GENERATED`).
- **Interview** — entretiens (date, format, lieu, contact, notes, préparation).
- **Outreach** — CRM personnel (entreprise, contact, canal, statut, dernier contact, prochaine relance).

## Engagement

- **Favorite** (collections), **SavedSearch**, **Notification**, **AlertPreference**, **DailyAction** (mission du jour), **Activity** (timeline, streak, statistiques), **Recommendation** (réservé aux recommandations persistées).

## IA & modération

- **AIConversation / AIMessage** — historique du copilote (fournisseur, modèle, tokens).
- **Report** — signalements (offre expirée, fausse offre, information/contact/entreprise incorrects) avec statut.

## Provenance, vérification et ingestion (phase données réelles)

- `Job` : `normalizedTitle`, `companyNameRaw`, `salaryPeriod`, `romeCode`, `nafCode`, `positionsCount`, `applicationEmail` / `applicationLabel` (canal publié dans l'offre), `verificationStatus` (`ACTIVE` / `UNKNOWN` / `EXPIRED` / `REMOVED`), `lastVerifiedAt`, `dataQualityScore` (0-100), `remote` accepte `UNKNOWN`.
- `JobSourceEntry` : une ligne par source qui publie l'offre — `externalId`, `url`, `applicationUrl` / `applicationEmail` / `applicationLabel`, `publishedAt`, `expiresAt`, `status`, `lastVerifiedAt`, `duplicateConfidence` (0-1), `isPrimary` (source de candidature retenue), `rawPayload`.
- `JobSource` : `priority` (page carrière 90 > source officielle 70 > agrégateur), `capabilities` (JSON).
- `IngestionRun` : journal de chaque exécution (`sourceKey`, `trigger`, `startedAt` / `finishedAt` / `durationMs`, `status` RUNNING / SUCCESS / PARTIAL / ERROR / SKIPPED, compteurs `fetched` / `created` / `updated` / `duplicate` / `rejected` / `failed` / `expired`, `errorSummary`, `errors`).
- `Company` : identité légale SIRENE (`legalName`, `brandName`, `siren`, `siret`, `nafCode` / `nafLabel`, `legalCategory`, `employeeRange` / `employeeRangeLabel`, `registeredAt`, `address`), `nameNormalized` (rapprochement), `sizeOrigin` (REAL / ESTIMATED / UNKNOWN / DEMO), `isPlaceholder` (fiche « Employeur non communiqué », jamais listée), `dataSources` (JSON `[{ source, url, fetchedAt, label }]`), `lastVerifiedAt`.
- `Contact` : `displayName`, `jobId` (offre d'origine), `contactUrl`, `source = JOB_POSTING`, `publiclyAvailable`, `professionalContext`, `verifiedAt`, `confidenceScore`, `optOutAt`.
- `DataOrigin` gagne `UNKNOWN` ; `ContactSource` gagne `JOB_POSTING`.

Migrations : `20260909191314_real_data_pipeline` (colonnes, `IngestionRun`, extension `unaccent`, configuration `french_unaccent`, index GIN et trigrammes), `company_size_origin`, `remote_policy_unknown`.

## Index

Index B-tree sur les clés étrangères, villes/régions/départements, familles et secteurs, dates, coordonnées ; index GIN plein texte (`to_tsvector('french', title || description)`) sur `job` et `company` ; index trigram (`pg_trgm`) sur les titres et noms.

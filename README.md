# Alternance OS

> **Le système d'exploitation de la recherche d'alternance.**
> Toutes les offres, les entreprises à contacter et les outils nécessaires pour décrocher une alternance, réunis au même endroit. Objectif unique : **réduire le temps nécessaire pour obtenir une alternance.**

Alternance OS n'est pas un jobboard. C'est un assistant personnel qui trie l'information, calcule une compatibilité explicable pour chaque offre, repère les entreprises qui recrutent sans annonce, suit les candidatures, programme les relances et rédige les documents à partir du profil de l'utilisateur. À tout moment, le produit propose **la prochaine action la plus utile**.

Expérience poussée pour les **Pays de la Loire** (Nantes, Saint-Nazaire, Angers, Le Mans…) et la **Bretagne** (Rennes, Brest, Vannes, Lorient…), fonctionnelle pour toute la France.

---

## Sommaire

- [Données réelles](#données-réelles)
1. [Fonctionnalités opérationnelles](#fonctionnalités-opérationnelles)
2. [Stack technique](#stack-technique)
3. [Installation](#installation)
4. [Variables d'environnement](#variables-denvironnement)
5. [Base de données](#base-de-données)
6. [Données de démonstration (seed)](#données-de-démonstration-seed)
7. [Développement](#développement)
8. [Build & production](#build--production)
9. [Tests](#tests)
10. [Architecture](#architecture)
11. [Fournisseurs externes](#fournisseurs-externes)
12. [Sécurité & RGPD](#sécurité--rgpd)
13. [Déploiement](#déploiement)
14. [Feuille de route](#feuille-de-route)

---

## Données réelles

La plateforme fonctionne avec de vraies offres dès qu'une source est configurée. Chaque donnée porte sa provenance : `REAL` (source vérifiable), `DEMO` (seed), `ESTIMATED` (règles), `AI_GENERATED`, `UNKNOWN` (aucune source). **Une absence de donnée est préférée à une donnée inventée.**

```bash
# 1. Identifiants France Travail dans .env (voir docs/PROVIDERS.md), puis :
npm run test:france-travail -- --q developpeur --city Nantes --radius 30   # auth → recherche → stockage → dédoublonnage → vérification
npm run jobs:sync                          # départements prioritaires (44, 49, 53, 72, 85, 35, 29, 56, 22), 31 jours
npm run jobs:sync -- --q developpeur --city Nantes --radius 30
npm run jobs:verify                        # re-vérifie l'existence des offres auprès de la source
npm run jobs:expire                        # règles d'expiration (14 j → « non re-vérifiée », 45 j → expirée)
npm run companies:import -- --department 44 --family dev   # entreprises réelles (SIRENE) par département et NAF

# 2. Masquer la démonstration
DEMO_MODE=false  NEXT_PUBLIC_DEMO_MODE=false
```

Ce que l'utilisateur voit : la source de chaque offre (« France Travail »), sa date de vérification (« Vérifiée il y a 3 h » / « Non re-vérifiée depuis 12 jours »), « Offre trouvée sur N sources » avec la page carrières privilégiée pour candidater, le canal de candidature publié dans l'offre, le score de qualité des données, et pour les entreprises la source (offre officielle, SIRENE), le SIREN et la dernière vérification. La page publique [`/sources`](http://localhost:3000/sources) résume tout ; l'admin `/admin/data` détaille les exécutions (`IngestionRun`), les doublons, les offres non vérifiées et les données de démonstration.

## Fonctionnalités opérationnelles

| Domaine | Ce qui fonctionne réellement |
|---|---|
| **Landing & SEO** | Landing page complète (hero + recherche, chiffres, fonctionnement, offres récentes, entreprises, témoignages *clairement marqués fictifs*, fonctionnalités, CTA). Pages `/alternance/[ville]` et `/alternance/[métier]/[ville]` générées statiquement (ISR 1 h), JSON-LD `JobPosting` sur les offres non-démo, `sitemap.xml`, `robots.txt`, pages légales (confidentialité, CGU, mentions). |
| **Couverture nationale et fraîcheur** | Synchronisation nationale France Travail reprenable (points de reprise par département × fenêtre, découpe des fenêtres tronquées par nature de contrat puis par moitiés, reprise après interruption), quota manager global (débit, concurrence, backoff, `Retry-After`, gigue, priorités, compteur partagé par minute), synchronisation continue toutes les deux heures à quatre priorités, rafraîchissement live d'une recherche après la réponse (jamais bloquant), fraîcheur interne (FRESH / RECENT / STALE / UNKNOWN), badge « Nouveau », « Synchronisé avec France Travail il y a … » toujours daté, offres absentes de deux listages complets retirées des recherches (historique conservé), rapport `db:coverage`, section « Couverture nationale » dans l'admin. Voir `docs/SYNC.md`. |
| **Sans compte (mode visiteur)** | Principe : **utiliser d'abord, créer un compte ensuite si cela apporte de la valeur.** Accueil, recherche (métier, ville, rayon), fiches offres et entreprises, Radar, carte, comparateur, sources et pages SEO sont accessibles sans inscription ; « Candidater » ouvre la destination officielle sans compte. « Personnaliser mes résultats » (formation, niveau, ville, rayon, compétences, métier : 30 s) donne un Match Score et un Radar personnalisés, stockés uniquement dans le navigateur (cookie non sensible + localStorage, 90 jours). Favoris sans compte dans le navigateur ; après l'inscription, « N favoris trouvés — les ajouter à ton compte » (import idempotent, favoris locaux effacés seulement après confirmation) ; profil visiteur repris dans l'onboarding puis effacé une fois le profil enregistré ; la destination demandée (`next`) est conservée de l'inscription jusqu'à la fin de l'onboarding. Le cookie visiteur est traité comme une entrée non fiable (schéma strict, bornes, 90 jours, jamais une autorisation). Routes classées dans `src/config/routes.ts` : `PUBLIC_ROUTES`, `AUTH_OPTIONAL_ROUTES` (`/dashboard`, `/favorites` expliqués sans compte), `PROTECTED_ROUTES` (candidatures, CV, copilote, notifications, paramètres, admin). |
| **Auth** | Email + mot de passe (better-auth, scrypt), Google et Microsoft si configurés, rate limiting, redirections via `proxy.ts` **uniquement sur les routes protégées**, compte démo. |
| **Onboarding** | Assistant en 5 étapes (< 3 min) : identité & métier (famille détectée), formation, localisation & mobilité (rayon, permis, véhicule, télétravail), contrat (dates, durée, rythme), compétences & secteurs. **Import CV (PDF/texte)** avec préremplissage prénom, ville, niveau, compétences, sans invention. |
| **Dashboard** | « Bonjour [Prénom] », **mission du jour** persistée et complétable, prochaine meilleure action, 4 KPI, prochains entretiens, 3 meilleurs matchs, entreprises à contacter, activité récente, objectif hebdo + série de jours actifs. |
| **Offres** | `/jobs` en 3 colonnes (filtres, liste, détail **sans rechargement**), filtres complets (ville/rayon/région, télétravail, niveau, contrat, durée, fraîcheur, métiers, secteurs, compatibilité min.), tri, pagination, **requête en langage naturel** (« cybersécurité à Rennes Bac+3 dans un rayon de 30 km »), fiche `/jobs/[slug]`, trajets estimés domicile/école. |
| **Match Score** | `calculateMatchScore(candidat, offre)` : formation 25 · compétences 30 · localisation 20 · expérience 10 · rythme 5 · mobilité 10. Règles lisibles, raisons ✓ et avertissements ⚠ (« Python apparaît dans l'annonce mais pas dans ton profil »). Voir `docs/SCORING.md`. |
| **Favoris** | Collections Priorité / À candidater / Entreprises / À surveiller, déplacement, notes. |
| **Entreprises** | Annuaire filtrable (recherche plein texte, ville/rayon, secteur, taille, alternants, recrute), fiche complète (offres, métiers, technologies, implantations, contacts publics avec badges de provenance, entreprises similaires), **contact recommandé** selon la taille (`recommendBestContact`), **candidature spontanée** guidée (contact, angle, documents, ajout au suivi). |
| **Opportunity Radar** | Entreprises pertinentes même sans offre, classées par `OpportunityScore` (proximité, métier, secteur, alternants, recrutements, taille) — toujours présenté comme **estimation**. Filtres rayon/taille/secteur/sans offre. |
| **Candidatures** | Kanban 8 colonnes **drag & drop** avec machine à états, historique d'événements, fiche latérale (statut, dates, prochaine action, notes, interlocuteur, CV, documents), **relances recommandées à 7 jours** (générer / marquer / reporter), jamais d'envoi automatique. |
| **Outreach** | CRM personnel : entreprise, contact, canal, statut, dernier contact, prochaine relance, retards. |
| **CV** | Import PDF (validation MIME par signature binaire, 5 Mo), versions multiples (« CV Développement », « CV Data »…), éditeur texte, **CV Score** par règles (lisibilité, structure, mots-clés, compétences, longueur, ATS, orthographe-signaux) avec points forts/faibles/améliorations, **Adapter mon CV à cette offre** (couverture, manquants, expériences à développer, sans invention). |
| **Copilote IA** | Chat en **streaming** avec contexte minimal issu du compte (profil, offres, radar, relances, entretiens, stats selon la question), génération de **lettre, email, message LinkedIn, relance, préparation d'entretien, adaptation de CV, pitch spontané**, documents sauvegardés, quotas par plan. Abstraction `lib/ai` : Anthropic (SDK officiel), OpenAI-compatible, **mock déterministe sans clé** (mode démo signalé). |
| **Entretiens** | Planification liée à une candidature (passage auto en « Entretien », notification), fiche avec préparation générée (entreprise, questions probables, points forts, questions à poser), notes, statuts. |
| **Carte** | MapLibre + OpenStreetMap (sans clé) ou style personnalisé, clusters, bascule Offres / Entreprises, filtres, popups, fallback liste sans WebGL. |
| **Comparateur** | Jusqu'à 4 offres : compatibilité, salaire, distance, télétravail, taille, secteur, niveau, durée, rythme, compétences. |
| **Statistiques** | Candidatures, réponses, entretiens, offres, taux, candidatures/semaine (graphique), sources efficaces — **aucun taux affiché sous 5 envois**. |
| **Mode urgence** | Plan intensif (objectifs semaine 30 / 20 / 5, offres et entreprises du jour, relances) et mission du jour renforcée. |
| **Notifications** | Centre de notifications in-app, page dédiée, préférences (canaux, types, fréquence, seuil de compatibilité). |
| **Paramètres & RGPD** | Compte, profil candidat complet (expériences, formations, projets), alertes, **export JSON de toutes les données**, **suppression définitive du compte**, bandeau cookies (cookies strictement nécessaires uniquement). |
| **Signalements** | Offre expirée, fausse offre, information / contact / entreprise incorrects, traités dans l'admin. |
| **Admin** | `/admin` (rôle ADMIN) : statistiques, offres (activer/désactiver/supprimer), entreprises (drapeaux), utilisateurs (rôle, plan), signalements, contacts (**droit d'opposition**), sources (activation, synchronisation). |
| **Agrégation** | `services/job-sources` : interface `JobSourceProvider`, providers Manuel / Sites carrières (flux fournis) / **France Travail (API officielle)**, normalisation vers un format unique, **déduplication** (`duplicateConfidenceScore`, version canonique + sources conservées), ingestion. Aucun scraping en violation de CGU. |
| **Qualité** | Mode clair/sombre, responsive mobile-first, accessibilité (clavier, ARIA, focus visible, zones cliquables), états loading / error / empty partout, badges Démo / Estimation / Vérifié / Généré par IA. |

Non implémenté volontairement (architecture prête) : paiement Premium (plans et quotas existent), envoi d'emails, push, espace recruteur/école.

---

## Stack technique

- **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers, Turbopack), **React 19**, **TypeScript strict**
- **Tailwind CSS v4**, primitives UI shadcn-style sur `radix-ui`, **Lucide** icons, `next-themes`, `sonner`, `cmdk`, `@dnd-kit`, `recharts`, `maplibre-gl` + `react-map-gl`
- **PostgreSQL** + **Prisma 7** (driver `pg`), index plein texte (`tsvector` français) et trigrammes (`pg_trgm`)
- **better-auth** (email/mot de passe, Google, Microsoft Entra ID)
- **Zod 4** pour toute validation serveur
- **@anthropic-ai/sdk** (Claude) derrière une abstraction provider
- **Vitest** (unitaires) et **Playwright** (parcours critiques)

---

## Installation

Prérequis : Node.js ≥ 22, PostgreSQL ≥ 14 (local, Docker, Neon, Supabase, Railway…).

```bash
git clone <repo> alternance && cd alternance
npm install                 # génère aussi le client Prisma (postinstall)
cp .env.example .env        # puis renseigne DATABASE_URL et BETTER_AUTH_SECRET
npm run db:migrate          # crée le schéma (migrations Prisma)
npm run db:seed             # données de démonstration (fictives)
npm run dev                 # http://localhost:3000
```

Compte démo : `demo@alternance.demo` / `Demo1234!` · Admin : `admin@alternance.demo` / `Admin1234!`

Base locale rapide avec Docker :

```bash
docker run --name alternance-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=alternance -p 5432:5432 -d postgres:16
```

---

## Variables d'environnement

Toutes documentées dans [`.env.example`](.env.example). L'application fonctionne **sans aucune clé externe** : sans clé IA elle passe en mode démo (provider mock signalé), sans identifiants France Travail la source est désactivée proprement, sans style de carte elle utilise OpenStreetMap.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | PostgreSQL |
| `BETTER_AUTH_SECRET` | oui | secret de session (≥ 16 caractères, `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | oui en prod | URL publique |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` | non | connexion sociale |
| `AI_PROVIDER` (`anthropic` \| `openai` \| `mock`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_EFFORT`, `OPENAI_*` | non | copilote et génération |
| `NEXT_PUBLIC_MAP_STYLE_URL`, `TRAVEL_TIME_PROVIDER`, `OSRM_BASE_URL` | non | carte et trajets |
| `FRANCE_TRAVAIL_CLIENT_ID/SECRET` | non | agrégation France Travail |
| `LA_BONNE_ALTERNANCE_API_KEY`, `LA_BONNE_ALTERNANCE_KEY_TYPE` | non | deuxième source La bonne alternance (clé de production requise pour ingérer) |
| `ADMIN_EMAILS` | non | emails promus ADMIN à l'inscription |
| `NEXT_PUBLIC_DEMO_MODE` | non | badges et mentions « démo » |

---

## Base de données

- Schéma : [`prisma/schema.prisma`](prisma/schema.prisma) — 32 modèles (User, CandidateProfile, Education, Experience, Project, Language, Skill, UserSkill, Resume, ResumeVersion, Company, CompanyLocation, Contact, Job, JobSkill, JobSource, JobSourceEntry, Application, ApplicationEvent, GeneratedDocument, Favorite, SavedSearch, Notification, AlertPreference, Interview, AIConversation, AIMessage, Recommendation, DailyAction, Activity, Outreach, Report). Détail dans [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).
- Migrations : `prisma/migrations` (la migration initiale ajoute les index GIN plein texte et `pg_trgm`).
- Commandes : `npm run db:migrate` (dev), `npm run db:deploy` (prod), `npm run db:studio`, `npm run db:generate`.

---

## Données de démonstration (seed)

`npm run db:seed` exécute `prisma/seed.ts` (reproductible, PRNG à graine fixe) :

- 186 compétences (référentiel `src/config/skills.ts`)
- 46 entreprises **fictives** (ESN, cloud, agences, banques, assurances, naval, aéro, industrie, agro, PME, TPE, startups) principalement à Nantes, Saint-Nazaire, Angers, Le Mans, Rennes, Brest, Vannes, Lorient, Paris
- 144 offres réparties par métier, 58 contacts démo **sans coordonnées réelles**
- un compte démo avec profil, CV analysé, candidatures à tous les statuts (dont relances dues), entretien, favoris, outreach, notifications, mission du jour

Toutes les entités portent `isDemo = true` / `dataOrigin = DEMO` et sont affichées avec un badge « Démo ». Ne jamais les présenter comme réelles.

---

## Développement

```bash
npm run dev          # serveur de dev (Turbopack)
npm run typecheck    # next typegen + tsc --noEmit
npm run lint         # ESLint (règles Next + React Compiler)
npm run format       # Prettier
npm run test         # Vitest
```

Conventions : TypeScript strict (`noUncheckedIndexedAccess`), pas de `any`, validation Zod dans chaque Server Action, `ActionResult` typé, logs structurés (`lib/logger`), composants courts et réutilisables, features isolées.

---

## Build & production

```bash
npm run build        # prisma generate + next build
npm run start
```

Le build exige `DATABASE_URL` (le sitemap interroge la base, avec repli si elle est indisponible).

---

## Tests

```bash
npm run test                       # unitaires (tests/unit) : Match Score (y compris données incomplètes),
                                   # opportunité, priorité, prochaine action, contacts, dédoublonnage 0-1,
                                   # validation & qualité d'ingestion, parseurs France Travail, synonymes,
                                   # filtres, statuts, relances, analyse CV, complétion, streak
npm run test:integration           # pipeline d'ingestion contre la base locale + client France Travail simulé
                                   # (auth, pagination, 204/400/401/429/5xx, timeouts) — DATABASE_URL requis
npm run test:all                   # unitaires + intégration
npm run test:e2e                   # Playwright : parcours critique §69 sur desktop ET mobile + smoke des pages
CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e   # utiliser un Chromium déjà installé
npm run smoke                      # smoke navigateur rapide contre un serveur déjà lancé

# Tests externes (réseau et/ou clés requis, jamais lancés par `npm test`)
npm run test:france-travail        # API France Travail de bout en bout (code 2 si identifiants absents)
npm run test:ai-provider           # fournisseur IA réel : requête, streaming, erreur, annulation
npm run test:osrm                  # temps de trajet routé (instance OSRM)
npm run test:companies             # API Recherche d'entreprises (SIRENE)
npm run test:external              # enchaîne les quatre
npm run smoke:real-data            # France Travail → pipeline → base LOCALE jetable → Match Score → rapport qualité
```

Codes de retour des scripts externes : `0` succès, `2` configuration manquante (la variable manquante est nommée), `1` échec avec catégorie explicite (`NETWORK_ERROR`, `AUTH_ERROR`, `RATE_LIMIT`, `INVALID_RESPONSE`, `FAILED`). Les mêmes validations s'exécutent depuis GitHub Actions (workflows manuels « External validation » et « Real data smoke test ») : voir [`docs/GITHUB_ACTIONS.md`](docs/GITHUB_ACTIONS.md) pour les secrets à créer et l'ordre de lancement.

## Architecture

```
src/
  app/            routes (App Router) : (marketing), (auth), (onboarding), (explore), (app), admin, api
  components/     ui (primitives), layout (coquille), shared (états, badges, inputs)
  features/       un dossier par domaine : jobs, companies, applications, favorites, resume, copilot,
                  radar, dashboard, onboarding, profile, notifications, interviews, outreach,
                  analytics, compare, urgence, settings, admin, reports, marketing, seo, map
                    ├─ components/  (UI)   ├─ server/ (queries.ts, actions.ts)   └─ lib/ (règles pures)
  lib/            db, auth, env, logger, action, rate-limit, geo, text, skills, matching, ai, search
  services/       job-sources (providers, normalisation, déduplication, ingestion)
  config/         taxonomie (secteurs, métiers, niveaux…), villes, compétences, navigation, plans
  generated/      client Prisma (non versionné)
prisma/           schéma, migrations, seed
tests/unit        unitaires (Vitest)      tests/integration  base locale + clients simulés
tests/e2e         Playwright              tests/external     services réels (GitHub Actions ou local, docs/GITHUB_ACTIONS.md)
docs/             ARCHITECTURE, DATA-MODEL, SCORING, PROVIDERS, DEPLOYMENT
```

Principes : la logique métier est **pure et testée** (`lib/matching`, `features/*/lib`), les accès données sont dans `features/*/server/queries.ts`, les mutations dans des Server Actions validées par Zod, les fournisseurs externes (IA, recherche, cartes, sources d'offres, trajets) sont derrière des **interfaces** avec repli. Détail dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Fournisseurs externes

Détail complet dans [`docs/PROVIDERS.md`](docs/PROVIDERS.md). Règle commune : une intégration non configurée le dit (variable manquante nommée) et **ne simule jamais** ; les données absentes restent vides.

| Domaine | Intégration | Clé | Test |
|---|---|---|---|
| Offres | France Travail « Offres d'emploi v2 » (`FranceTravailProvider`) | `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` | `npm run test:france-travail` |
| Offres | La bonne alternance — API Alternance du Ministère du Travail, licence Etalab-2.0 (`LaBonneAlternanceProvider` ; relais France Travail ignorés) | `LA_BONNE_ALTERNANCE_API_KEY` + `LA_BONNE_ALTERNANCE_KEY_TYPE=production` | `npm run test:lba` |
| Offres | Flux carrières fournis (JSON Feed / RSS) | `CAREER_FEEDS_JSON` | — |
| Entreprises | API Recherche d'entreprises (SIRENE, open data) | aucune | `npm run test:companies` |
| Contacts | Bloc « contact » des offres officielles uniquement | — | couvert par l'intégration |
| IA | Anthropic (`claude-opus-5`) ou API compatible OpenAI ; `mock` en démo ; indisponible sinon | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | `npm run test:ai-provider` |
| Trajets | OSRM (routé) ou heuristique (estimé) | `TRAVEL_TIME_PROVIDER`, `OSRM_BASE_URL` | `npm run test:osrm` |
| Recherche | PostgreSQL `french_unaccent` + synonymes | — | unitaires |
| Tâches | CLI `jobs:sync` / `jobs:verify` / `jobs:expire` / `companies:import` et `/api/cron/*` | `CRON_SECRET` | — |

## Sécurité & RGPD

- Validation Zod côté serveur, `ActionResult` sans fuite d'erreur interne, contrôle d'accès par utilisateur sur chaque ressource, rôle ADMIN vérifié en base
- Mots de passe hachés (scrypt), cookies `HttpOnly`/`SameSite`, en-têtes de sécurité (`nosniff`, `X-Frame-Options`, `Referrer-Policy`)
- Rate limiting (auth, upload, IA, signalements), contrôle des uploads (taille, **signature binaire**), rendu Markdown sans HTML brut
- RGPD dès le MVP : politique de confidentialité, consentement à l'inscription, bandeau cookies (cookies strictement nécessaires), **export JSON**, **suppression de compte**, droit d'opposition sur les contacts, provenance de chaque donnée (`dataOrigin`). Aucune revente de données.

---

## Déploiement

Cible : **Vercel** + PostgreSQL managé (Neon, Supabase, Railway…). Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

```bash
# variables : DATABASE_URL, BETTER_AUTH_SECRET, NEXT_PUBLIC_APP_URL, BETTER_AUTH_URL (+ clés optionnelles)
npm run db:deploy && npm run build
```

---

## Feuille de route

- **Phase 2** : agrégation multi-sources en production (identifiants France Travail, flux partenaires), contacts vérifiés, emails de relance (Resend), alertes email, CV builder, recommandations avancées, push
- **Phase 3** : espace recruteur, écoles, matching recruteur ↔ candidat, application mobile, automatisations

Licence : privée.

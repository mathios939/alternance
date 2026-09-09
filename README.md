# Alternance OS

> **Le système d'exploitation de la recherche d'alternance.**
> Toutes les offres, les entreprises à contacter et les outils nécessaires pour décrocher une alternance, réunis au même endroit. Objectif unique : **réduire le temps nécessaire pour obtenir une alternance.**

Alternance OS n'est pas un jobboard. C'est un assistant personnel qui trie l'information, calcule une compatibilité explicable pour chaque offre, repère les entreprises qui recrutent sans annonce, suit les candidatures, programme les relances et rédige les documents à partir du profil de l'utilisateur. À tout moment, le produit propose **la prochaine action la plus utile**.

Expérience poussée pour les **Pays de la Loire** (Nantes, Saint-Nazaire, Angers, Le Mans…) et la **Bretagne** (Rennes, Brest, Vannes, Lorient…), fonctionnelle pour toute la France.

---

## Sommaire

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

## Fonctionnalités opérationnelles

| Domaine | Ce qui fonctionne réellement |
|---|---|
| **Landing & SEO** | Landing page complète (hero + recherche, chiffres, fonctionnement, offres récentes, entreprises, témoignages *clairement marqués fictifs*, fonctionnalités, CTA). Pages `/alternance/[ville]` et `/alternance/[métier]/[ville]` générées statiquement (ISR 1 h), JSON-LD `JobPosting` sur les offres non-démo, `sitemap.xml`, `robots.txt`, pages légales (confidentialité, CGU, mentions). |
| **Auth** | Email + mot de passe (better-auth, scrypt), Google et Microsoft si configurés, rate limiting, redirections via `proxy.ts`, compte démo. |
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
npm run test                       # unitaires : Match Score, opportunité, priorité, prochaine action,
                                   # contacts, déduplication, filtres & requête naturelle, statuts &
                                   # relances, analyse CV, complétion, streak (64 tests)
npm run test:e2e                   # Playwright : parcours critique §69 + smoke des pages
CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e   # utiliser un Chromium déjà installé
npm run smoke                      # smoke navigateur rapide (connexion démo → dashboard → pages) contre un serveur déjà lancé
```

Le parcours critique testé : accueil → inscription → onboarding → dashboard → recherche « développeur Nantes » → fiche + Match Score → sauvegarde → candidature → Kanban → statut « Envoyée » → relance recommandée.

---

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
tests/            unitaires (Vitest)      e2e/   Playwright
docs/             ARCHITECTURE, DATA-MODEL, SCORING, PROVIDERS, DEPLOYMENT
```

Principes : la logique métier est **pure et testée** (`lib/matching`, `features/*/lib`), les accès données sont dans `features/*/server/queries.ts`, les mutations dans des Server Actions validées par Zod, les fournisseurs externes (IA, recherche, cartes, sources d'offres, trajets) sont derrière des **interfaces** avec repli. Détail dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Fournisseurs externes

| Domaine | Interface | Implémentations | Sans configuration |
|---|---|---|---|
| IA | `AIProvider` (`lib/ai`) | Anthropic (SDK officiel, `claude-opus-5`), OpenAI-compatible, Mock | mock déterministe (mode démo) |
| Recherche | `FullTextSearchProvider` (`lib/search`) | PostgreSQL (tsvector + trigram) | — (prêt pour Meilisearch/Typesense/OpenSearch) |
| Sources d'offres | `JobSourceProvider` (`services/job-sources`) | Manuel, Sites carrières (flux), France Travail (API) | sources désactivées proprement |
| Trajets | `TravelTimeProvider` (`lib/geo/travel-time`) | OSRM, heuristique | estimation à vol d'oiseau |
| Carte | style MapLibre | OpenStreetMap, style personnalisé | OpenStreetMap |

Voir [`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

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

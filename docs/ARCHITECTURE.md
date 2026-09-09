# Architecture

## Vue d'ensemble

Alternance OS est une application **Next.js 16 (App Router)** monolithique mais organisée par domaines (`src/features/*`), avec une couche de **logique métier pure et testée** (`src/lib/matching`, `features/*/lib`) et des **abstractions** pour tout fournisseur externe. Cette organisation permet d'extraire plus tard des services (ingestion, IA, recherche) sans réécrire les features.

```
Navigateur ──► Next.js (RSC + Server Actions + Route Handlers)
                 │
                 ├─ features/*/server/queries.ts  ──► Prisma ──► PostgreSQL
                 ├─ features/*/server/actions.ts  (Zod, ActionResult, revalidatePath)
                 ├─ lib/ai        (AIProvider : Anthropic | OpenAI-compatible | Mock)
                 ├─ lib/search    (FullTextSearchProvider : PostgreSQL tsvector/trigram)
                 ├─ lib/geo       (haversine, TravelTimeProvider : OSRM | heuristique)
                 └─ services/job-sources (JobSourceProvider : Manual | CompanyCareer | FranceTravail)
```

## Groupes de routes

| Groupe | Coquille | Accès |
|---|---|---|
| `(marketing)` | header + footer publics, bandeau cookies | public |
| `(auth)` | carte centrée | public (redirigé si connecté) |
| `(onboarding)` | minimal | connecté, onboarding incomplet |
| `(explore)` | **coquille app si connecté, publique sinon** (`/jobs`, `/companies`) | mixte |
| `(app)` | sidebar + header + palette ⌘K | connecté et onboardé (`requireUser`) |
| `admin` | coquille app + navigation admin | rôle ADMIN (`requireAdmin`) |
| `api/*` | Route Handlers | selon route |

`src/proxy.ts` (ex-middleware) fait une vérification **optimiste** du cookie de session pour rediriger tôt ; la vérification réelle est faite dans les layouts serveur.

## Flux de données

- **Lecture** : Server Components → `queries.ts` (mis en cache par requête avec `react.cache` quand pertinent) → props sérialisables (`JobCardData`, `CompanyCardData`, …) vers les composants clients.
- **Écriture** : composants clients → Server Actions (`"use server"`) → `parseInput(zodSchema)` → Prisma → `revalidatePath` → `router.refresh()`. Toute action renvoie un `ActionResult` (`ok/fail`) : pas d'exception qui fuit vers le client.
- **Détail sans rechargement** : la page `/jobs` charge la liste côté serveur ; la sélection met à jour l'URL (`?job=slug`, nuqs) et récupère `/api/jobs/[slug]` (JSON) avec cache mémoire.
- **Streaming IA** : `/api/copilot` renvoie un flux `text/plain` ; le message assistant est persisté après le flux (`after()`).

## Scoring et priorisation

Toutes les règles sont dans `src/lib/matching` (documentées dans `SCORING.md`) :

- `calculateMatchScore(candidat, offre)` → score total + sous-scores + raisons.
- `calculateOpportunityScore(candidat, entreprise)` → potentiel estimé (Radar).
- `calculateOpportunityPriorityScore(...)` → ordre de traitement des offres.
- `getNextBestAction(état)` / `buildDailyMission(état)` → action la plus utile, mission du jour.
- `recommendBestContact(entreprise, candidat, contacts)` → interlocuteur recommandé.

Ces fonctions sont **pures** : aucun accès base, ce qui les rend testables (`tests/`).

## Agrégation des offres

Pipeline `src/services/ingestion` (SOURCE → FETCH → VALIDATION → NORMALIZATION → DEDUPLICATION → ENRICHMENT → DATABASE), providers `src/services/job-sources` avec capabilities et priorité, journal `IngestionRun`, vérification et expiration périodiques, commandes CLI `scripts/jobs-*.ts` et routes `/api/cron/*`. Les entreprises réelles proviennent des offres officielles et de l'open data SIRENE (`src/services/company-data`). Mode démonstration : `DEMO_MODE=false` masque tout ce qui est `isDemo` via `src/lib/demo-mode.ts` (`visibleJobsWhere`, `visibleCompaniesWhere`). Détails : `docs/PROVIDERS.md`.

### Ancien texte

`services/job-sources` :

1. `JobSourceProvider.fetchJobs()` renvoie des `RawJob` (format du fournisseur).
2. `normalizeJob()` produit un `NormalizedJob` unique (ville géocodée via le référentiel, niveaux/rythme/télétravail inférés, compétences extraites).
3. `duplicateConfidenceScore()` compare avec les offres récentes (entreprise, titre, ville, texte, URL, dates) ; au-dessus du seuil (78), l'offre est rattachée à sa **version canonique** (`canonicalJobId`) en conservant sa `JobSourceEntry`.
4. `ingestFromProvider()` crée/met à jour offres et entreprises, et journalise le statut de la source.

Règle : uniquement des sources légales (API officielle, flux fournis, saisie). Pas de scraping contraire aux CGU.

## IA

`src/lib/ai` :

- `types.ts` : `AIProvider` (`generate`, `stream`), erreurs typées.
- `providers/anthropic.ts` (SDK officiel `@anthropic-ai/sdk`, modèle `claude-opus-5`, `output_config.effort`), `providers/openai-compatible.ts` (fetch `chat/completions`, SSE), `providers/mock.ts` (règles déterministes à partir du **contexte structuré** : jamais d'invention).
- `context.ts` : `buildCopilotContext(userId, besoins)` charge **uniquement** les sections utiles (profil, CV, offre, entreprise, candidature, meilleures offres, radar, relances, entretiens, stats) ; `detectContextNeeds(message)` infère les besoins d'une question libre.
- `prompts.ts` : prompt système (ton, interdiction d'inventer, pas de formules creuses), sérialisation du contexte, consignes par type de document.

## Sécurité

Voir README (§ Sécurité & RGPD). Points clés : Zod partout, contrôle de propriété (`userId`) sur chaque ressource, rate limiting mémoire (interface remplaçable par Redis), upload validé par signature binaire, Markdown rendu sans HTML brut, en-têtes de sécurité dans `next.config.ts`.

## Évolutions prévues

- Externaliser l'ingestion dans un worker/cron (`ingestFromProvider` est déjà indépendant de Next).
- Remplacer la recherche PostgreSQL par Meilisearch/Typesense via `FullTextSearchProvider`.
- Rate limiting distribué (Upstash) via l'interface `RateLimiter`.
- Notifications email (Resend) en s'appuyant sur `AlertPreference`.

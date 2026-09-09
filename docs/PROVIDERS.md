# Fournisseurs externes

Tous les fournisseurs sont derrière une interface et disposent d'un **repli** propre. L'application fonctionne sans aucune clé.

## IA (`src/lib/ai`)

| Provider | Variables | Notes |
|---|---|---|
| `anthropic` | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (défaut `claude-opus-5`), `AI_EFFORT` | SDK officiel, streaming, `output_config.effort`, gestion des refus |
| `openai` | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | compatible OpenAI (Mistral, Groq, Ollama…) |
| `mock` | aucune | réponses déterministes construites à partir des données du compte, signalées « mode démo » |

Ajouter un fournisseur = implémenter `AIProvider` (`generate`, `stream`, `isConfigured`) et l'enregistrer dans `getAIProvider()`.

## Sources d'offres (`src/services/job-sources`)

| Provider | Configuration | Légalité |
|---|---|---|
| `manual` | — | saisie / seed |
| `company-career` | liste de flux `CareerFeed` (JSON Feed ou RSS) fournis par les entreprises | flux explicitement mis à disposition |
| `france-travail` | `FRANCE_TRAVAIL_CLIENT_ID/SECRET` (compte partenaire francetravail.io, scope `api_offresdemploiv2 o2dsoffre`) | API officielle |

Synchronisation : `/admin/sources` → « Synchroniser », ou `ingestFromProvider(provider)` depuis un script/cron. Jamais de scraping en violation des CGU (LinkedIn, Indeed…).

## Recherche (`src/lib/search`)

`PostgresSearchProvider` : `plainto_tsquery('french')` avec repli « au moins un mot » (`to_tsquery` préfixes), ILIKE sur titres/compétences, `similarity()` (pg_trgm) sur les noms d'entreprises. Pour Meilisearch/Typesense/OpenSearch : implémenter `FullTextSearchProvider` (`searchJobs`, `searchCompanies`) et l'enregistrer dans `getSearchProvider()`.

## Cartographie & trajets

- Carte : MapLibre GL ; fond OpenStreetMap par défaut, ou `NEXT_PUBLIC_MAP_STYLE_URL` (style MapLibre : MapTiler, Stadia, Mapbox via proxy…).
- Trajets : `TRAVEL_TIME_PROVIDER=osrm` (+ `OSRM_BASE_URL`, hébergez votre instance) pour des itinéraires réels ; sinon estimation à vol d'oiseau (vitesse moyenne) signalée « estimation » dans l'interface.

## Authentification

better-auth : email/mot de passe toujours actif ; Google (`GOOGLE_CLIENT_ID/SECRET`, callback `/api/auth/callback/google`) et Microsoft Entra ID (`MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`, callback `/api/auth/callback/microsoft`) affichés uniquement s'ils sont configurés.

## Email (Phase 2)

`RESEND_API_KEY` / `EMAIL_FROM` réservés pour les alertes et relances par email.

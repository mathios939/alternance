# Déploiement

## Mise en production pilotée par GitHub Actions (chemin recommandé)

Tout part des **secrets du dépôt** (GitHub repository → Settings → Secrets and variables → Actions) ; aucune valeur n'est jamais affichée dans les logs.

| Secret | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL **persistante** (Neon, Supabase, Railway…, URL « pooled » recommandée pour l'application). Seul `prisma migrate deploy` est exécuté : jamais de reset ni de `db push`. Les migrations passent par l'hôte **direct** (le workflow retire `-pooler.` de l'hôte Neon : le verrou consultatif de Prisma Migrate ne traverse pas un pooler en mode transaction), avec trois tentatives. |
| `VERCEL_TOKEN` | Jeton Vercel (Account → Settings → Tokens). Le workflow crée ou relie le projet, pousse les variables, déploie et vérifie l'URL. |
| `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` | Source réelle des offres (déjà validés par « External validation »). |
| `BETTER_AUTH_SECRET`, `CRON_SECRET` | Optionnels : s'ils manquent, le déploiement génère une valeur aléatoire **persistée dans Vercel** et la conserve ensuite. |

Workflows (onglet Actions, déclenchement manuel) :

1. **Production audit** : présence des secrets et variables.
2. **Production database** : `prisma migrate deploy`, puis ingestion réelle contrôlée d'un département (par défaut Loire-Atlantique, 31 jours, 300 offres max), entreprises SIRENE du département, vérification, état de la base (`npm run db:report`).
3. **Production deploy (Vercel)** : projet (preset `nextjs` imposé par `vercel.json` et par l'API, fonctions en région `fra1` comme la base), variables (`DEMO_MODE=false`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`…), migrations, **build exécuté chez Vercel** (les variables de type Secret ne peuvent pas être tirées localement), déploiement, détection de l'alias public réel, vérification des pages publiques et de `/api/health`.
4. **Production backfill (national)** (manuel) : rattrapage réel et reprenable du catalogue France Travail par territoire — périmètre `pdl` → `bretagne` → `ouest` → `france` ou liste de départements, fenêtre 31 j / 7 j / 3 j / 1 j, budget de temps ≤ 330 min. Un run interrompu reprend au même département au run suivant. Voir `docs/SYNC.md`.
5. **Production sync** (planifié **toutes les deux heures**, aussi manuel) : synchronisation nationale incrémentale à quatre priorités (nouveautés France entière 1 j → zones très demandées 7 j → recherches populaires → rattrapage progressif 31 j de N départements), puis `jobs:verify` (offres absentes des listages d'abord), `jobs:expire`, `db:coverage`. Idempotent, borné par le quota partagé, résumé dans chaque run, jamais deux exécutions simultanées (groupe partagé avec le backfill). Il remplace les crons Vercel.
6. **Production smoke test** (manuel, entrée : URL publique) : parcours visiteur Playwright desktop + mobile contre la production.

Variables de dépôt facultatives : `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`, `FRANCE_TRAVAIL_MAX_RPS` (débit soutenu vers France Travail, défaut 3/s, plafond 8/s sous la limite officielle de 10/s).

Endpoint de santé : `GET /api/health` → `app`, `database`, `demoMode`, `services.franceTravail`, `services.companyData`, `services.ai`, `services.travelTime`, compteurs d'offres réelles, dernière synchronisation et `coverage` (actives, < 24 h, < 7 j, découvertes < 24 h, départements synchronisés / total, par région). Aucune valeur secrète.

## Vercel + PostgreSQL managé (manuel)

1. Créer une base PostgreSQL (Neon, Supabase, Railway…) et récupérer `DATABASE_URL` (pooling recommandé : Neon/Supabase fournissent une URL « pooled »).
2. Importer le dépôt dans Vercel. Build command : `npm run build` (inclut `prisma generate`). Node 22.
3. Variables d'environnement (Production et Preview) :
   - `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ caractères), `NEXT_PUBLIC_APP_URL` et `BETTER_AUTH_URL` = URL du déploiement
   - optionnel : `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, connexions sociales, `NEXT_PUBLIC_MAP_STYLE_URL`, `FRANCE_TRAVAIL_*`, `ADMIN_EMAILS`, `NEXT_PUBLIC_DEMO_MODE=false`
4. Appliquer les migrations avant le premier trafic : `npx prisma migrate deploy` (en local avec `DATABASE_URL` de prod, ou via une étape de build/CI).
5. Optionnel : `npm run db:seed` pour une base de démonstration (données fictives, ne pas utiliser en production publique).

Notes :
- Les fichiers CV sont stockés en base (`bytea`) : pas de dépendance à un système de fichiers, compatible serverless. Pour de gros volumes, brancher un stockage objet dans `features/resume/server/actions.ts` (`saveResumeFile`).
- Le rate limiting est en mémoire (par instance). Pour plusieurs instances, implémenter `RateLimiter` avec Upstash/Redis.
- `proxy.ts` (edge) vérifie seulement la présence du cookie ; les pages vérifient la session en base.

## Docker / auto-hébergement

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run start   # PORT=3000
```

Base PostgreSQL 14+ avec l'extension `pg_trgm` disponible (créée par la migration initiale).

## Synchronisation des sources

Deux façons équivalentes d'exécuter les tâches (mêmes fonctions, jamais couplées à Vercel) :

```bash
npm run jobs:sync:national -- --scope france --window 31d   # rattrapage national reprenable (docs/SYNC.md)
npm run jobs:sync:national -- --mode incremental            # synchronisation continue à quatre priorités
npm run jobs:sync          # ingestion ciblée (une ville, un département, une requête)
npm run jobs:verify        # re-vérification des offres auprès de la source (absentes des listages d'abord)
npm run jobs:expire        # expiration selon les règles explicites
npm run companies:import   # import ciblé d'entreprises (SIRENE)
npm run db:coverage        # couverture réelle (TOTAL_OFFERS, ACTIVE_ALTERNANCE, LAST_24H, BY_REGION…)
```

ou en HTTP, avec `CRON_SECRET` défini : `GET /api/cron/sync|verify|expire|companies` avec `Authorization: Bearer $CRON_SECRET` (pour un ordonnanceur externe ; la planification par défaut est le workflow GitHub Actions « Production sync »). PostgreSQL doit disposer des extensions `unaccent` et `pg_trgm` (disponibles sur Neon, Supabase, RDS, Railway).

### Ancien texte

Planifier `ingestFromProvider` (cron Vercel, GitHub Actions, worker) une fois les identifiants France Travail ou des flux partenaires configurés. L'admin permet une synchronisation manuelle.

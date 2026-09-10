# Déploiement

## Mise en production pilotée par GitHub Actions (chemin recommandé)

Tout part des **secrets du dépôt** (GitHub repository → Settings → Secrets and variables → Actions) ; aucune valeur n'est jamais affichée dans les logs.

| Secret | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL **persistante** (Neon, Supabase, Railway…, URL « pooled » recommandée). Seul `prisma migrate deploy` est exécuté : jamais de reset ni de `db push`. |
| `VERCEL_TOKEN` | Jeton Vercel (Account → Settings → Tokens). Le workflow crée ou relie le projet, pousse les variables, déploie et vérifie l'URL. |
| `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` | Source réelle des offres (déjà validés par « External validation »). |
| `BETTER_AUTH_SECRET`, `CRON_SECRET` | Optionnels : s'ils manquent, le déploiement génère une valeur aléatoire **persistée dans Vercel** et la conserve ensuite. |

Workflows (onglet Actions, déclenchement manuel) :

1. **Production audit** : présence des secrets et variables.
2. **Production database** : `prisma migrate deploy`, puis ingestion réelle contrôlée (par défaut Loire-Atlantique, 31 jours, 300 offres max), entreprises SIRENE du département, vérification, état de la base (`npm run db:report`).
3. **Production deploy (Vercel)** : projet, variables (`DEMO_MODE=false`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`…), migrations, build, déploiement, vérification des pages publiques et de `/api/health`.
4. **Production sync** (planifié trois fois par jour, aussi manuel) : `jobs:sync` (départements de la variable `SYNC_DEPARTMENTS`, `44` par défaut, 7 jours), `jobs:verify`, `jobs:expire`. Idempotent, borné, résumé dans chaque run, jamais deux exécutions simultanées. Il remplace les crons Vercel (non disponibles en sous-quotidien sur le plan Hobby).

Endpoint de santé : `GET /api/health` → `app`, `database`, `demoMode`, `services.franceTravail`, `services.companyData`, `services.ai`, `services.travelTime`, compteurs d'offres réelles et dernière synchronisation. Aucune valeur secrète.

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
npm run jobs:sync          # ingestion France Travail (départements prioritaires)
npm run jobs:verify        # re-vérification des offres auprès de la source
npm run jobs:expire        # expiration selon les règles explicites
npm run companies:import   # import ciblé d'entreprises (SIRENE)
```

ou en HTTP, avec `CRON_SECRET` défini : `GET /api/cron/sync|verify|expire|companies` avec `Authorization: Bearer $CRON_SECRET` (pour un ordonnanceur externe ; la planification par défaut est le workflow GitHub Actions « Production sync »). PostgreSQL doit disposer des extensions `unaccent` et `pg_trgm` (disponibles sur Neon, Supabase, RDS, Railway).

### Ancien texte

Planifier `ingestFromProvider` (cron Vercel, GitHub Actions, worker) une fois les identifiants France Travail ou des flux partenaires configurés. L'admin permet une synchronisation manuelle.

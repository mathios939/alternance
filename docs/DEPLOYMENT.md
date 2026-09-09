# Déploiement

## Vercel + PostgreSQL managé

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

ou en HTTP, avec `CRON_SECRET` défini : `GET /api/cron/sync|verify|expire|companies` avec `Authorization: Bearer $CRON_SECRET` (`vercel.json` planifie sync 5 h, verify toutes les 6 h, expire 6 h 15, companies le lundi). PostgreSQL doit disposer des extensions `unaccent` et `pg_trgm` (disponibles sur Neon, Supabase, RDS, Railway).

### Ancien texte

Planifier `ingestFromProvider` (cron Vercel, GitHub Actions, worker) une fois les identifiants France Travail ou des flux partenaires configurés. L'admin permet une synchronisation manuelle.

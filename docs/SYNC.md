# Synchronisation nationale et fraîcheur des offres

Objectif : récupérer **le maximum d'offres d'alternance réellement disponibles** via les sources configurées (France Travail en premier), sur **toute la France**, avec **la meilleure fraîcheur techniquement possible**, sans jamais dépasser les quotas des APIs ni compromettre la disponibilité du site. Tout ce qui est affiché est mesuré ; rien n'est estimé ni promis « en temps réel ».

## 1. Unités de travail et points de reprise

| Notion | Où | Rôle |
|---|---|---|
| Territoire | code département (`src/config/departments.ts`, 96 métropole + 5 outre-mer = 101) | granularité de la source (`departement=` France Travail) et de la reprise |
| Fenêtre | `1d`, `3d`, `7d`, `31d` (date de création côté source) | `[since, until]` explicite (`minCreationDate` / `maxCreationDate`) |
| Morceau (`SyncChunk`) | `{ since, until, natures? }` | une requête paginée à la source (≤ 3 150 résultats, borne de pagination France Travail) |
| Point de reprise (`sync_checkpoint`) | une ligne par (fournisseur, nature, territoire, fenêtre) | `status`, `cursor` (morceaux restants), `nextCursor` (reprise), `lockedBy` / `lockedAt` (verrou, expiré après 10 min), `lastSuccessAt`, `lastError`, compteurs, `truncated`, `hitCount` (recherches live) |

`syncTerritory` (`src/services/ingestion/national-sync.ts`) :

1. **réserve** le point de reprise (`updateMany` conditionnel : jamais deux workers sur la même unité ; un verrou expiré est repris) ;
2. ignore le territoire si son dernier succès est plus récent que `maxAgeHours` (sauf `--force`) ;
3. **reprend** le curseur d'un run précédent interrompu (`nextCursor`) ou part de la fenêtre entière ;
4. pour chaque morceau : `runIngestion` (pipeline complet, idempotent). Si la source annonce plus de résultats que la borne (`truncated`), le morceau est **découpé** : d'abord par nature de contrat (apprentissage `E2` / professionnalisation `FS`), puis par moitiés de fenêtre (le plus récent d'abord), jusqu'à une heure. Le curseur est persisté après chaque morceau (battement du verrou) ;
5. au **budget de temps** (`deadline`), le territoire s'interrompt proprement : `PARTIAL` + `nextCursor` ; le run suivant reprend là (si le run s'arrête au 56, il ne recommence pas la France depuis zéro) ;
6. après un listage **complet** (aucun morceau tronqué ni en erreur) : **réconciliation** (§ 4) ;
7. `SUCCESS` (ou `PARTIAL`) avec compteurs, `lastSuccessAt`, verrou libéré.

`runNationalSync` enchaîne les territoires dans l'ordre du plan (`planTerritories` : Pays de la Loire et Bretagne, puis les zones très demandées, puis le reste) sous un budget de temps global. `staleTerritories` choisit les territoires à rattraper : reprises (`PARTIAL` / `ERROR`) d'abord, puis jamais synchronisés, puis les plus anciens.

Commandes :

```bash
npm run jobs:sync:national -- --scope pdl                          # Pays de la Loire, fenêtre 31 j
npm run jobs:sync:national -- --scope bretagne --window 31d
npm run jobs:sync:national -- --scope france --window 31d --max-minutes 320
npm run jobs:sync:national -- --departments 44,49 --window 7d --force
npm run jobs:sync:national -- --mode incremental --max-minutes 100 --backfill-budget 12
npm run db:coverage                                                 # couverture réelle mesurée
```

## 2. Quota manager (`src/services/job-sources/quota.ts`)

Limite officielle France Travail (API Offres d'emploi v2) : **10 appels / seconde** par application. Valeurs par défaut volontairement en dessous : `FRANCE_TRAVAIL_MAX_RPS=3` (plafond 8), `FRANCE_TRAVAIL_MAX_CONCURRENCY=2` (plafond 4).

| Mécanisme | Détail |
|---|---|
| Débit | seau à jetons (rafale = débit, régénération continue) |
| Concurrence | requêtes simultanées bornées |
| Priorité | file `live` > `recent` > `verify` > `backfill` : une recherche live passe avant le rattrapage |
| 429 | `Retry-After` honoré, sinon backoff exponentiel (1 s → 60 s), gigue jusqu'à 25 %, pause **globale** du processus ; remise à zéro au premier succès |
| Quota partagé | compteur par fournisseur et par minute en base (`provider_quota`, incrément atomique) : workers GitHub Actions et fonctions Vercel ne dépassent jamais ensemble le plafond (`débit × 60` par minute) ; un worker qui trouve la minute pleine attend la suivante (avec gigue) |
| Live | jamais d'attente : refus (`QuotaExceededError`) si le seau local est vide ou si la minute partagée dépasse 60 % du plafond |

Chaque appel du client France Travail passe par `acquire(priority)` ; les tests unitaires (`tests/unit/quota.test.ts`) couvrent débit, concurrence, priorités, refus live, pénalité 429 et plafond partagé.

## 3. Synchronisation continue (priorités)

Workflow **Production sync** (`.github/workflows/production-sync.yml`, toutes les deux heures, `--mode incremental`) :

| Priorité | Quoi | Fenêtre | Condition |
|---|---|---|---|
| 1 | nouvelles offres, **France entière** | `1d` | territoire non synchronisé depuis 1 h 30 |
| 2 | zones très demandées (`PRIORITY_DEPARTMENT_CODES` + `HOT_DEPARTMENT_CODES`) | `7d` | depuis 12 h |
| 3 | recherches populaires (points de reprise `LIVE_SEARCH`, `hitCount ≥ 2`) | live | actualisation > 2 h |
| 4 | rattrapage du reste du catalogue, N territoires les plus anciens (`--backfill-budget`, 12 par run) | `31d` | depuis 20 h |

Puis `jobs:verify` (600 offres, celles absentes d'un listage d'abord), `jobs:expire`, `db:coverage`. Le workflow **Production backfill** (manuel) fait le rattrapage initial par périmètre (`pdl` → `bretagne` → `ouest` → `france`) ; il partage le groupe de concurrence de la synchronisation planifiée.

Coût mesuré d'un passage : une requête par département et par morceau non tronqué (≈ 101 requêtes pour la priorité 1 quand un département tient en une page), 1 requête par tranche de 150 offres au-delà. À 3 requêtes/s, la couverture nationale d'une fenêtre de 31 jours coûte quelques minutes d'API ; le temps réel est dominé par l'écriture en base des nouvelles offres.

## 4. Fraîcheur, nouveautés, expiration

**Rafraîchissement live** (`src/services/ingestion/live-refresh.ts`) : sur `/jobs` avec une ville connue (ou un département), la page est servie **immédiatement** depuis la base ; après la réponse (`after()` de Next.js), la zone est rafraîchie auprès de France Travail (une page de 150 offres, 60 traitées au plus, priorité `live`) si sa dernière actualisation a plus de **15 minutes**, si aucun autre processus ne la rafraîchit (verrou `LIVE_SEARCH`) et si le quota le permet. TTL choisi : la synchronisation planifiée passe toutes les deux heures ; 15 minutes par zone active bornent le coût à 4 requêtes / heure / zone (100 zones actives ≈ 7 requêtes / minute, contre un plafond partagé de 180 / minute).

**Affichage véridique** : « Synchronisé avec France Travail il y a 18 s · Nantes (30 km) » — date du dernier rapprochement réel de notre copie locale avec la source pour cette recherche, sinon pour le département, sinon pour la France ; « actualisation en cours… » pendant un rafraîchissement live. Jamais « temps réel ».

**Fraîcheur interne** (`src/lib/freshness.ts`, jamais affichée brute) à partir de `publishedAt`, `sourceUpdatedAt` (`dateActualisation` France Travail), `discoveredAt`, `lastVerifiedAt` :

| Niveau | Règle |
|---|---|
| FRESH | actualisée < 48 h et confirmée < 24 h |
| RECENT | actualisée < 14 j et confirmée < 7 j |
| STALE | confirmée > 14 j ou actualisée > 45 j |
| UNKNOWN | jamais confirmée |

Badge **« Nouveau »** : découverte par nous < 48 h **et** publiée < 7 j (une vieille offre découverte lors d'un rattrapage n'est pas « nouvelle »). Tris : Pertinence (texte, priorité, puis nouveautés), Plus récentes, Meilleur match, Distance.

**Expiration rapide** : après un listage complet d'un département, une offre publiée dans la fenêtre mais absente est **manquée** (`missedListings + 1`, entrée et offre `UNKNOWN`, vérifiée en priorité par `jobs:verify`) ; absente de **deux listages consécutifs** → `REMOVED`, retirée des recherches. Les offres retirées ou expirées **restent en base** pour les favoris et candidatures. Une offre qui réapparaît est réactivée (`missedListings = 0`). Les règles d'expiration existantes (`expire.ts`) restent en place.

**Dédoublonnage multi-sources** : inchangé (`dedupe.ts`) — même identifiant dans la même source = mise à jour ; même URL = doublon ; sinon score entreprise + titre + lieu + description + dates. Deux offres de la même source avec des identifiants distincts ne sont jamais fusionnées ; « même entreprise + titre proche » sans lieu commun reste **distinct**. Lorsqu'une offre existe sur un agrégateur et sur le site carrière, la candidature pointe vers la source la plus prioritaire (page carrière > France Travail), les autres restent visibles en provenance.

## 5. Base de données et performance (mesuré)

Schéma (migrations `national_sync` et `search_vector`) : `job.sourceUpdatedAt`, `job_source_entry.sourceUpdatedAt` / `missedListings`, `sync_checkpoint`, `provider_quota`, index `job(discoveredAt)`, `job_source_entry(sourceId, lastVerifiedAt)`, index **partiels** sur les offres visibles (`publishedAt`, `latitude/longitude`, `department + publishedAt`), colonne générée **`searchVector`** (titre + description + compétences, configuration `french_unaccent`) avec index GIN, index trigramme existant sur `normalizedTitle`.

Mesure : `npm run db:perf` (base locale uniquement, 40 000 offres synthétiques insérées puis supprimées, `EXPLAIN ANALYZE`) — 10 septembre 2026, PostgreSQL 16 :

| Requête | Avant | Après | Index utilisé |
|---|---|---|---|
| liste nationale, 600 plus récentes | — | 1,1 ms | `job_visible_published_idx` (partiel) |
| département + publiées < 7 j | — | 1,1 ms | `job_visible_department_idx` (partiel) |
| découvertes < 24 h | — | 1,0 ms | `job_discoveredAt_idx` |
| rayon 30 km autour de Nantes (boîte englobante + 600 plus récentes) | 29 ms | 28 ms | parcours séquentiel (le `OR` télétravail / ville sans coordonnées empêche l'index ; acceptable) |
| plein texte « développeur » (terme présent dans la plupart des lignes synthétiques : pire cas) | 1 422 ms (vecteur recalculé) · 2 877 ms (avec `ILIKE` titre + compétences) | **96 ms** (vecteur stocké) | classement depuis la colonne stockée |
| plein texte « comptable » (terme sélectif) | — | 63 ms | idem |
| comptage des actives / groupBy région (santé, couverture) | — | 28 ms / 32 ms | parcours séquentiel des lignes visibles |

Décision de cache, mesurée et non arbitraire : avec ces temps (< 100 ms pour la recherche au pire cas à 40 000 offres, ~1 ms pour les listes indexées), **aucun cache applicatif inter-requêtes n'est ajouté sur les résultats de recherche** — un cache court dégraderait la fraîcheur (recherche live) pour un gain de quelques dizaines de millisecondes. Les référentiels lents et stables restent en cache long : communes France Travail (par processus), synonymes et taxonomie (statiques). Le rapport de couverture (une quinzaine de requêtes, ≈ 300 ms à 40 000 offres) est calculé à la demande (`/api/health`, admin, `db:coverage`), pas sur les pages publiques. À revoir au-delà de ~200 000 offres actives : cache 60 s des compteurs de couverture, index partiel sur `region`.

## 6. Observabilité

- **Admin → Qualité des données → « Couverture nationale — France Travail »** : dernier sync, quota consommé sur 60 min (pic / plafond), offres actives, nouvelles 24 h (publiées et découvertes), départements synchronisés `x / 101` (< 24 h, au moins une fois, en cours), erreurs (dernière erreur), retards, retirées / expirées sur 7 j, par région, départements les mieux couverts, fenêtres, recherches live.
- **`GET /api/health`** : `coverage.activeAlternance`, `last24h`, `last7Days`, `discovered24h`, `territoriesSynced24h / territoriesTotal`, `lastSyncAt`, `byRegion`.
- **`npm run db:coverage`** (et résumé de chaque run GitHub Actions) : `TOTAL_OFFERS`, `ACTIVE_ALTERNANCE`, `LAST_24H`, `LAST_7_DAYS`, `DISCOVERED_24H`, `PAYS_DE_LA_LOIRE`, `BRETAGNE`, `AUTRES_REGIONS`, `BY_REGION`, `BY_DEPARTMENT`, `BY_SOURCE`, `TERRITORIES_*`, `LAST_SYNC`, `LIVE_SEARCHES`, `REMOVED_7_DAYS`, `EXPIRED_7_DAYS`.
- Journal : `ingestion_run` (une ligne par morceau, déclencheur `national`, `live`, `cron`…), `sync_checkpoint`, `provider_quota`.

## 7. Filtre alternance et nouvelles sources

Seules les offres identifiées comme alternance par la source sont récupérées : codes nature de contrat lus dans le **référentiel officiel** France Travail (`naturesContrats`, libellés « apprentissage » / « professionnalisation », repli `E2`, `FS`). La validation (`validate.ts`) rejette `NOT_ALTERNANCE` ce que la source ne déclare pas comme alternance et qui ne le mentionne pas. Aucune offre CDI / CDD n'est jamais transformée en alternance.

Les sources supplémentaires (flux carrières fournis, ATS à endpoint public, partenaires, dépôt direct) sont listées avec leur statut et ce qu'elles exigent dans `docs/PROVIDERS.md` ; aucune n'est activée sans validation réelle de bout en bout, et jamais par scraping interdit.

### Deuxième source : La bonne alternance (API Alternance, Ministère du Travail)

- **Ce qui a été vérifié** (workflow « Source discovery », depuis un runner avec réseau) : documentation OpenAPI joignable (`/api/documentation/json`), licence **Etalab-2.0**, CGU <https://api.apprentissage.beta.gouv.fr/cgu>, authentification par **clé d'API** (`Authorization: Bearer`), 401 sans clé sur `/job/v1/search` et `/job/v1/export`, ancienne API v1 de La bonne alternance retirée (404). Limites déclarées : recherche 60 appels / min et 150 offres max par source (jamais exhaustive) ; export complet 2 appels / min, mis à jour chaque jour à 3 h (Paris).
- **Intégration** (`LaBonneAlternanceProvider`, clé `la-bonne-alternance`, type `PARTNER`, priorité 60) : couverture nationale par l'export complet, chargé une fois par processus et **découpé par département** pour réutiliser les points de reprise (`sync_checkpoint`, provider `la-bonne-alternance`, fenêtre `120d`) et la réconciliation des offres disparues ; recherche autour d'une ville par `/job/v1/search`. Les offres relayées depuis **France Travail sont ignorées** (déjà ingérées à la source) : les doublons inter-sources mesurés dans l'admin (« Partagées ») sont donc de vrais doublons entre catalogues distincts, rapprochés par `dedupe.ts` (identifiant, URL, entreprise, titre, ville, description, dates ; seuil 0,92 pour rattacher, 0,75 – 0,92 masqué et listé en admin, jamais deux offres distinctes d'une même entreprise fusionnées).
- **Quota dédié** : 0,5 appel / s, 1 requête simultanée, 30 / min (moitié de la limite officielle), 419 / 429 → `Retry-After`, compteur `provider_quota` séparé. La recherche live des pages publiques reste servie par France Travail seule (aucune recherche utilisateur n'appelle toutes les API).
- **Activation** : secret `LA_BONNE_ALTERNANCE_API_KEY` + variable `LA_BONNE_ALTERNANCE_KEY_TYPE=production` (une clé sandbox renvoie des données de test : ingestion refusée). « Production sync » exécute alors `jobs:sync:national --source la-bonne-alternance --scope france --window 120d` (30 min par run, reprenable) ; « Production backfill » accepte `source = la-bonne-alternance`.
- **Mesure de l'apport** (`/admin/sources`, `db:coverage` → `BY_SOURCE`) : offres actives portées par la source, uniques (seule porteuse), partagées (doublons inter-sources), erreurs 24 h, latence moyenne, fraîcheur.

## 8. Limites connues

- Les offres localisées seulement au niveau d'une région (« 52 - Pays de la Loire ») ne sont pas couvertes par les recherches par département (elles ne sont plus mal attribuées à un département : `department = null`, `region` renseignée) ; une passe par région est une évolution possible.
- Prisma Migrate propose de « supprimer » les index partiels, la colonne générée et son index lors de la génération d'une nouvelle migration (`migrate dev --create-only`) : retirer ces lignes `DROP INDEX` / `DROP DEFAULT` du fichier généré, elles sont voulues.
- GitHub Actions planifie au mieux toutes les deux heures ; un run peut être retardé de quelques minutes par la plateforme. L'affichage reste véridique puisqu'il date la dernière synchronisation réelle.

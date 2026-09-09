# Validation externe avec GitHub Actions

Cet environnement de développement n'a pas d'accès Internet : les intégrations réelles (France Travail, API Recherche d'entreprises, OSRM, fournisseur IA) se valident **depuis GitHub Actions** ou **depuis une machine locale avec réseau**. Les deux chemins exécutent exactement les mêmes scripts (`tests/external/*.ts`).

Statut du projet tant que ces workflows n'ont pas été exécutés avec succès : **INTEGRATION_TESTED** (serveurs simulés, base locale). Une exécution réussie fait passer chaque service à **EXTERNAL_VERIFIED**.

## 1. Créer les secrets et variables

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions**.

### Onglet « Secrets » (Repository secrets → New repository secret)

| Secret | Obligatoire pour | Où l'obtenir |
|---|---|---|
| `FRANCE_TRAVAIL_CLIENT_ID` | France Travail, smoke test | <https://francetravail.io> : compte, application, abonnement à l'API « Offres d'emploi v2 » |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | France Travail, smoke test | même écran (clé secrète de l'application) |
| `ANTHROPIC_API_KEY` | Fournisseur IA (si `AI_PROVIDER=anthropic`) | <https://console.anthropic.com> |
| `OPENAI_API_KEY` | Fournisseur IA (si `AI_PROVIDER=openai`) | console du fournisseur compatible OpenAI |
| `OSRM_BASE_URL` | OSRM (uniquement si l'URL de votre instance est confidentielle ; sinon utilisez une variable) | votre instance OSRM |

### Onglet « Variables » (Repository variables → New repository variable)

| Variable | Rôle | Exemple |
|---|---|---|
| `AI_PROVIDER` | Fournisseur IA à tester : `anthropic` ou `openai` (déduit de la clé présente si absent) | `anthropic` |
| `ANTHROPIC_MODEL` | Modèle Anthropic (défaut `claude-opus-5`) | `claude-opus-5` |
| `OPENAI_MODEL` / `OPENAI_BASE_URL` | Modèle et endpoint compatible OpenAI (optionnels) | `gpt-4.1` |
| `OSRM_BASE_URL` | Instance OSRM à tester (sans slash final) | `https://osrm.exemple.fr` |
| `COMPANY_DATA_PROVIDER` | Laisser vide ; `none` désactive le test entreprises | — |

Aucune de ces valeurs ne doit apparaître dans Git, le README, `.env.example`, les logs ni les captures. Les workflows n'affichent que la **présence** d'un secret, jamais sa valeur ; GitHub masque de toute façon les secrets dans les logs.

## 2. Lancer les workflows

Chemin : **onglet Actions du dépôt → workflow dans la colonne de gauche → bouton « Run workflow » → choisir la branche → Run workflow**. Ils ne se déclenchent jamais automatiquement (`workflow_dispatch` uniquement).

### Ordre recommandé

1. **External validation** (`.github/workflows/external-validation.yml`). Quatre jobs indépendants : `france-travail-validation`, `company-api-validation`, `osrm-validation`, `ai-provider-validation`, puis un job `summary` qui écrit le tableau « External Validation » dans le résumé du run (PASS / FAIL / NOT CONFIGURED, latence, nombre de résultats, fournisseur, date).
2. **Real data smoke test** (`.github/workflows/real-data-smoke-test.yml`), seulement une fois France Travail en PASS. Il démarre un PostgreSQL éphémère (conteneur de service), applique les migrations (`prisma migrate deploy`), ingère au plus 50 vraies offres (« développeur », Nantes, 30 km par défaut), rejoue l'ingestion pour prouver le dédoublonnage, calcule le Match Score avec un candidat synthétique et publie le rapport : Fetched, Normalized, Rejected, Inserted, Duplicates, Missing location, Missing application URL, Missing description, Companies matched, Match Score calculated, External URLs valid format, qualité moyenne. La base est détruite avec le runner ; **aucune base de production n'est jamais contactée**.

### Lecture des résultats

| Résultat | Signification |
|---|---|
| `PASS` | vérifié en conditions réelles |
| `NOT CONFIGURED` | secret ou variable absent : le job affiche `SKIPPED — SECRET NOT CONFIGURED` et reste vert, rien n'est simulé |
| `FAIL (NETWORK_ERROR)` | service injoignable, timeout, 5xx |
| `FAIL (AUTH_ERROR)` | identifiants refusés (vérifier le secret et l'abonnement à l'API) |
| `FAIL (RATE_LIMIT)` | limite de débit atteinte : relancer plus tard |
| `FAIL (INVALID_RESPONSE)` | réponse inattendue : le format de l'API a peut-être changé, ouvrir les logs du job |
| `FAIL (FAILED)` | autre erreur, détail dans les logs |

Chaque job dépose aussi un fichier JSON non sensible (`.external-results/<slug>.json`) et une section dans le résumé du run.

## 3. Exécuter les mêmes validations en local

Prérequis : Node 22, `npm ci`, un fichier `.env` contenant les variables nécessaires (jamais commité).

```bash
npm run test:france-travail            # France Travail : auth, référentiels, recherche (≤ 50), normalisation, vérification
npm run test:france-travail -- --store # + stockage et dédoublonnage dans la base locale
npm run test:companies                 # API Recherche d'entreprises : 2 requêtes, 5 fiches
npm run test:osrm                      # OSRM : un trajet Nantes → Saint-Nazaire (OSRM_BASE_URL requise)
npm run test:ai-provider               # fournisseur IA : deux requêtes de ~20 jetons, clé invalide, annulation
npm run test:external                  # enchaîne les quatre et résume
npm run smoke:real-data                # pipeline complet dans une base LOCALE jetable (garde-fou : hôte localhost)
```

Codes de retour : `0` succès, `2` configuration manquante (la variable manquante est nommée), `1` échec avec catégorie (`NETWORK_ERROR`, `AUTH_ERROR`, `RATE_LIMIT`, `INVALID_RESPONSE`, `FAILED`). Tous les appels externes ont un timeout (15 s France Travail et entreprises, 15 s OSRM, 60 s IA) et un nombre de tentatives borné.

Pour le smoke test local, utilisez une base dédiée, par exemple :

```bash
createdb alternance_smoke
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/alternance_smoke npx prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/alternance_smoke npm run smoke:real-data -- --limit 30
```

## 4. Séparation des familles de tests

| Commande | Contenu | Réseau |
|---|---|---|
| `npm test` / `npm run test:unit` | `tests/unit` : logique pure | non |
| `npm run test:integration` | `tests/integration` : pipeline sur base locale, client France Travail **simulé** | non |
| `npm run test:e2e` | `tests/e2e` : Playwright | non (serveur local) |
| `npm run test:external`, `npm run smoke:real-data` | `tests/external` : services réels | **oui**, volontairement hors CI classique |

Les appels réseau ne peuvent donc jamais rendre `npm test` instable.

## 5. Ce que ces workflows ne font pas encore

- Aucune écriture dans une base de production : la synchronisation planifiée en production sera mise en place dans une phase ultérieure, après validation.
- Aucun déclenchement automatique sur push ou pull request.

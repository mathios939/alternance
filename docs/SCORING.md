# Règles de scoring

Toutes les règles sont explicites, sans nombre pseudo-scientifique. Elles vivent dans `src/lib/matching` et sont couvertes par `tests/`.

## Match Score (offre ↔ candidat)

Pondérations (total 100) : **formation 25 · compétences 30 · localisation 20 · expérience 10 · rythme & durée 5 · mobilité & télétravail 10**. Chaque sous-score est sur 100.

| Critère | Règle |
|---|---|
| Formation | niveau du candidat dans la fourchette de l'offre → 100 ; un niveau sous le minimum → 60 ; deux → 30 ; plus → 10 ; au-dessus du maximum → 80 (1 niveau) / 65 ; niveau non renseigné → 50 (avertissement) ; offre sans exigence → 90 |
| Compétences | 70 % × chevauchement pondéré (requises = 1, optionnelles = 0,5) + 30 si la famille de métier correspond (8 si différente, 15 si inconnue). Offre sans compétence : 85 si métier aligné, sinon 55/65 |
| Localisation | télétravail complet → 100 ; distance ≤ ⅓ du rayon → 100, ≤ ⅔ → 85, ≤ rayon → 70, ≤ 1,5 × rayon → 40 (50 avec véhicule), au-delà → 60 si mobilité nationale ou régionale (même région), sinon 15. Sans coordonnées : même ville 90, même département 70, même région 45/65, sinon 20 (55 si national) |
| Expérience | ≥ 12 mois → 100, ≥ 6 → 85, ≥ 1 → 70, aucune → 55 ; +8 par mot-clé d'expérience présent dans l'intitulé (max 100) |
| Rythme & durée | rythme identique 100, offre sans rythme 80, candidat sans rythme 75, différent 45 ; durée identique 100, écart ≤ 6 mois 75, sinon 50 ; combinaison 70/30 |
| Mobilité | candidat 100 % télétravail vs offre sur site −45 ; hybride vs sur site −20 ; > 15 km sur site sans véhicule −20 ; type de contrat différent −15 |

Niveaux : ≥ 85 excellent · ≥ 70 bon · ≥ 50 partiel · < 50 faible. Les raisons (✓ / ⚠ / •) sont générées à partir des mêmes règles.

## OpportunityScore (entreprise, Radar)

**Estimation** (toujours affichée comme telle) : proximité 25 · métier compatible 20 (+10 par technologie commune) · secteur souhaité 15 · historique d'alternants 20 · recrute actuellement 10 · taille 10 (PME 100, ETI 90, GE 75, TPE 55) · bonus activité récente ≤ +5. Niveaux : ≥ 75 cible prioritaire, ≥ 55 bonne cible, sinon secondaire.

## OpportunityPriorityScore (ordre de traitement des offres)

matchScore 40 · récence 20 (≤ 24 h 100, ≤ 3 j 85, ≤ 7 j 65, ≤ 30 j 40, sinon 15) · distance 15 · concurrence estimée 10 (taille d'entreprise, population de la ville, télétravail complet, ancienneté) · intérêt du candidat 10 (favori) · pertinence entreprise 5 (secteur souhaité).

## Prochaine meilleure action

Ordre de priorité : entretien < 72 h → profil < 60 % → CV absent → relances dues → offres ≥ 75 % → favoris non traités → entreprises du Radar ≥ 60 % → objectif hebdo en retard. La mission du jour prend les 5 (7 en mode urgence) meilleures actions avec un plafond par type pour rester variée.

## Contact recommandé

Grande entreprise / ETI → Talent Acquisition / RH (90), manager métier (70) ; PME → manager métier (92), RH (85), direction (65) ; TPE → dirigeant (95), responsable d'équipe (80). Bonus vérifié +5, pondération par le score de confiance de la fiche. Sans contact : « Aucun contact vérifié disponible » — jamais d'invention.

## Relances

Candidature envoyée depuis ≥ 7 jours sans réponse → relance recommandée ; nouvelle relance 7 jours après la précédente ; maximum 3 ; report (« ignorer ») possible ; urgence haute à partir de 14 jours. Rien n'est envoyé automatiquement.

## CV Score

Longueur 10 · structure 20 · ATS (coordonnées, symboles) 15 · compétences 20 · mots-clés du métier 15 · lisibilité (verbes d'action, chiffres, paragraphes) 12 · orthographe (signaux) 8. L'analyse est **par règles** ; le copilote peut la compléter.

## Déduplication

URL identique (hors paramètres de tracking) → 100. Sinon : même entreprise +30, même ville +12, titre identique +30 (proche +20, similaire +8), description quasi identique +22 (similaire +12, un peu +5), dates ≤ 3 j +6 (≤ 14 j +3, > 60 j −15). Entreprises différentes : plafond 55. Seuil de doublon : 78.

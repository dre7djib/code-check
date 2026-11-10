# Plans d'implémentation `code-check`

Détail exécutable du [plan de réalisation](../plan_code_check.md). Le plan v1 reste le cadre (objectifs, principes, séparation des rapports). Ces fichiers disent quoi créer, dans quel ordre, et comment accepter le résultat.

Les contrats partagés (chemins, `rules.yml`, schémas, codes de sortie, droits des agents) sont dans [00-conventions.md](00-conventions.md). Chaque phase les cite au lieu de les redéfinir.

## Hypothèses de travail

La phase 0 doit les confirmer. Tant qu'elles ne sont pas contredites par la note de cadrage, les phases suivantes les tiennent pour acquises.

| # | Sujet | Hypothèse v1 |
|---|---|---|
| 1 | Hôtes | Corrigée par la note de cadrage. Mistral Vibe, GitHub Copilot, Claude Code et Cursor chargent le même paquet. Le détail est dans [00-conventions.md](00-conventions.md). |
| 2 | Pre-push | Revue rapide seule, désactivée par défaut. La sécurité fast ne part pas avec le hook. |
| 3 | Composants figés | Un propriétaire plateforme, nommé en phase 0, relit chaque bump de commit. |
| 4 | Rapports sécurité | `<repo>/.review/runs/<run-id>/security/`, `0700`, gitignoré (avec le run). Pas d'outil central en v1. |
| 5 | Mode deep | Poste développeur si un sandbox OS est disponible. Sinon le run deep s'arrête après la validation statique et laisse les pistes en `needs_validation`. |
| 6 | Axes v1 | Architecture, nommage, tests, erreurs, puis simplicité (phase 3). La section 9 du plan v1 reste hors livraison. |

## Ordre

```
0 Cadrage
1 Socle
2 Revue MVP ────── 7 Évaluation (dès la phase 2, en continu)
3 Simplicité
4 Sécurité fast
5 Directeur /check
6 Sécurité deep
8 Pilote
```

La phase 7 démarre en parallèle de la phase 2. On n'élargit pas les axes tant que son seuil de faux positifs n'est pas accepté.

| Phase | Plan | Durée | Dépend de |
|---|---|---|---|
| 0 | [Cadrage](phase-0-cadrage.md) | 2 à 3 jours | — |
| 1 | [Socle](phase-1-socle.md) | 1 semaine | 0 |
| 2 | [Revue MVP](phase-2-revue-mvp.md) | 1,5 semaine | 1 |
| 3 | [Simplicité et tokens](phase-3-simplicite.md) | 3 à 4 jours | 2 |
| 4 | [Sécurité fast](phase-4-securite-fast.md) | 1 semaine | 1, et 2 pour la preuve « absent de REVIEW.md » |
| 5 | [Directeur](phase-5-directeur.md) | 3 à 4 jours | 2 et 4 |
| 6 | [Sécurité deep](phase-6-securite-deep.md) | 1 semaine | 4 et 5 |
| 7 | [Évaluation](phase-7-evaluation.md) | en continu | 2, puis chaque phase suivante ajoute ses cas |
| 8 | [Pilote](phase-8-pilote.md) | 2 semaines | 5, 6, 7 |

## Règle de lecture

Chaque plan a le même squelette : objectif, prérequis, hors périmètre, fichiers, tâches, contrats propres à la phase, tests d'acceptation. Une tâche n'est pas commencée si son prérequis n'est pas coché.

Si la note de cadrage (phase 0) contredit un plan de phase, la note gagne et le plan de phase est mis à jour avant le code.

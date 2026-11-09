# Rapport tokens — phase 3

Mesure A/B sur le fixture `java-planted` (`scripts/measure-tokens.sh`, sans réseau). A : `rules.yml` intégral dans chaque prompt de reviewer. B : résumé Caveman des règles hors `architecture:` + bloc `architecture:` recopié tel quel. Tokens = caractères / 4, estimation (aucun usage mesuré par l'hôte). Ce fichier ne contient pas de code source.

Reproduire : `scripts/measure-tokens.sh <runA> <runB> eval/expected/java-planted.json --host <hôte> --out eval/token-report.md`.

## Hôte claude

| | Run A (règles intégrales) | Run B (règles compactes) |
|---|---|---|
| Caractères, prompts reviewers (5 axes) | 9388 | 7928 |
| dont règles | 1483 | 1191 |
| Tokens estimés (caractères / 4) | 2347 | 1982 |
| Findings attendus perdus | 0 | 0 |

Ratio B / A : 0.84 sur le prompt complet, 0.80 sur le bloc de règles. Les tokens sont une estimation, pas un usage mesuré par l'hôte.
Aucun finding attendu perdu en B.
Verdict : acceptable.

## Limites de cette mesure

- Un seul hôte passé : Claude Code, reviewers lancés comme sous-agents Claude. Cursor, Copilot et Vibe ne sont pas mesurés ; un gain sur un seul hôte ne valide pas le critère du plan.
- Le résumé compact (`rules.compact.txt`) a été écrit par l'assistant en suivant les règles de `skills/caveman/SKILL.md`, pas par un orchestrateur hôte. Ids, globs, suffixes et sévérités sont exacts.
- Le gain est modeste (-16 % sur le prompt complet, -20 % sur les règles) : le bloc `architecture:` est recopié sans compression (garde-fou), et les règles du fixture sont courtes.
- Les findings de A pour architecture, nommage, tests et erreurs viennent du run de la phase 2 (même fixture, prompt de format plus ancien) ; seul `simplicity` a été relancé avec le prompt A.
- Variance observée sur les reviewers, indépendante de la compression : le reviewer d'architecture a rendu un objet hors schéma (clé `message`, sans `id`) 1 fois sur 2 en A et 1 fois sur 2 en B ; le reviewer de nommage a cité la ligne 34 au lieu de 6 (fichier de 10 lignes) à chaque passage en B. Réponses : exemple JSON littéral ajouté aux agents (non rejoué), et ancrage des lignes dans `build-report.cjs` (recale `line` sur la première ligne de `evidence`). Sans cet ancrage, B perdait 2 des 4 attendus.
- B a produit un finding de plus (`tests` sur `OrderService.java:7`), classé « inattendu » : candidat faux positif.

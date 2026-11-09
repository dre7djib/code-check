---
name: review
description: Commande review. Cadre le run, lance les checks déterministes, fait relire quatre axes (architecture, nommage, tests, erreurs) par des reviewers isolés, et écrit REVIEW.md.
disable-model-invocation: true
---

# review

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session. Suivre la procédure de `agents/review/orchestrator.md` (lue, pas improvisée), dans cette conversation :

1. Skill `rules-loader`, puis skill `scoping` (`--command review`, `--host` = hôte de la session). Code 3 : afficher le message, sortir avec 3, ne rien créer.
2. `bash <plugin>/scripts/run-deterministic.sh <run>/context.json <run>/deterministic`.
3. Lancer **en parallèle** un reviewer isolé par axe de `context.json` : agents `review-architecture`, `review-naming`, `review-tests`, `review-errors` de l'hôte. Quatre chemins dans le message (`context.json`, `rules.yml`, `diff.patch`, chemin de sortie), rien d'autre. Si l'hôte ne sait pas ouvrir un contexte neuf : s'arrêter, code 3, « délégation indisponible sur cet hôte ».
4. Pour chaque réponse : `node <plugin>/scripts/save-findings.cjs <axe> <run>` avec le JSON sur stdin.
5. Skill `review-report` (`build-report.cjs`). Afficher `summary.txt` tel quel.

Code de sortie : celui de `build-report.cjs` (1 bloquant, 2 axe manquant sans bloquant, 0 sinon).

## Interdits

- Faire les axes soi-même dans cette conversation.
- Passer `review-findings.json` aux reviewers.
- Écrire `REVIEW.md` à la main, ou y mettre une piste de sécurité.
- Créer `.review/<nom-du-repo>/runs/` à la racine du workspace.
- Modifier le code du repo.

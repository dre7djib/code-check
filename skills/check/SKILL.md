---
name: check
description: Commande check. Cadre une fois, lance la revue de code et la sécurité fast, rend deux rapports séparés et des compteurs seulement.
disable-model-invocation: true
---

# check

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session. Suivre la procédure de `agents/director.md` (lue, pas improvisée), dans cette conversation :

1. Argument `deep` : « utiliser la commande check-deep (revue + deep) ou security-deep (deep seul) », code 3.
2. `node <plugin>/scripts/check-access.cjs <repo> check` (code 3 : message, sortie).
3. Skills `rules-loader` puis `scoping` (`--command check`, `--host` = hôte de la session), une seule fois.
4. Suivre `agents/review/orchestrator.md` (skill `review`) et `agents/security/orchestrator.md` (skill `security`) sur le même run, chacun avec des agents à contexte neuf ; en parallèle si l'hôte sait ouvrir deux contextes, sinon à la suite (`--sequential`). Hôte sans contexte neuf : code 3, « délégation indisponible sur cet hôte ».
5. Pistes croisées : quand `cross-hints.json` existe, seule l'étape `add-hints` de la sécurité est relancée.
6. `await-pipeline.cjs` pour chaque pipeline, puis `build-summary.cjs`. Afficher sa sortie telle quelle.

Code de sortie : celui de `build-summary.cjs` (0, 1, 2).

## Interdits

- Lire autre chose que `summary.json` dans le dossier sécurité.
- Reformuler, citer ou résumer un finding de sécurité.
- Recalculer le diff pour un orchestrateur.
- Lancer le deep, ou les deux pipelines dans la même conversation.
- Fusionner les deux rapports, ou modifier le code.

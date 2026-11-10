---
name: check-deep
description: Commande check-deep. Cadre une fois en mode deep, lance la revue de code et la sécurité deep (skill Cloudflare), rend deux rapports séparés et des compteurs seulement. Exige security.access: deep.
disable-model-invocation: true
---

# check-deep

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session. Suivre la procédure de `agents/director-deep.md` (lue, pas improvisée), dans cette conversation :

1. `node <plugin>/scripts/check-access.cjs <repo> check-deep` (code 3 : message, sortie). Exige `security.access: deep`.
2. `bash <plugin>/scripts/check-deep-prereqs.sh` : code 3, message, sortie, sans créer de run.
3. Skills `rules-loader` puis `scoping` (`--command check-deep`, `--host` = hôte de la session), une seule fois (`mode: deep`).
4. Suivre `agents/review/orchestrator.md` (skill `review`) et `agents/security/deep.md` (skill `security-deep`, run déjà cadré) sur le même run, chacun avec des agents à contexte neuf ; en parallèle si l'hôte sait ouvrir deux contextes, sinon à la suite (`--sequential`). Hôte sans contexte neuf : code 3, « délégation indisponible sur cet hôte ».
5. Ne pas lancer `add-hints` ni le pipeline sécurité fast.
6. `await-pipeline.cjs` pour chaque pipeline, puis `build-summary.cjs`. Afficher sa sortie telle quelle.

Code de sortie : celui de `build-summary.cjs` (0, 1, 2).

## Interdits

- Lire autre chose que `summary.json` dans le dossier sécurité.
- Reformuler, citer ou résumer un finding de sécurité.
- Recalculer le diff pour un orchestrateur.
- Remplacer le deep par le pipeline fast, ou lancer les deux pipelines dans la même conversation.
- Fusionner les deux rapports, ou modifier le code.

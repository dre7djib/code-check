---
name: security
description: Commande security. Revue de sécurité en mode fast sur le diff — un chasseur, un vérificateur isolé, findings.json validé au schéma Cloudflare.
disable-model-invocation: true
---

# security

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session. Suivre la procédure de `agents/security/orchestrator.md` (lue, pas improvisée), dans cette conversation :

1. Skills `rules-loader` puis `scoping` (`--command security`, `--host` = hôte de la session) si le run de revue n'existe pas ; sinon réutiliser le dernier. Code 3 : afficher le message, sortir avec 3.
2. `bash <plugin>/scripts/prepare-security-dir.sh <nom-du-repo> <run-id> <run>` puis `node <plugin>/scripts/security-fast.cjs prepare <run> <sec>`.
3. Lancer l'agent `security-hunter` de l'hôte (contexte neuf) avec le contenu de `<sec>/hunter.prompt.md`. Enregistrer sa réponse : `security-fast.cjs save-candidates <sec>`.
4. `security-fast.cjs verifier-prompts <sec>`, puis un agent `security-verifier` neuf par candidat, avec `verify/<n>.prompt.md` seulement. Enregistrer : `security-fast.cjs save-verdict <sec> <n>`. Hôte sans contexte neuf : s'arrêter, code 3, « délégation indisponible sur cet hôte ».
5. Skill `security-contract`, puis `security-fast.cjs finalize <sec> --target <repo> --threshold <seuil de rules.yml>`. Code 4 : corriger une fois les verdicts refusés, relancer.
6. Afficher la dernière sortie de `finalize` (compteurs et chemin du dossier). Aucun titre de finding dans le terminal.

Code de sortie : celui de `finalize` (0, 1, 2).

## Interdits

- Faire chasse et vérification dans la même conversation.
- Passer au vérificateur autre chose que son `verify/<n>.prompt.md`.
- Écrire `confirmed`, un markdown à la main, ou un fichier hors du dossier sécurité.
- Écrire ou lire le dossier sécurité depuis `REVIEW.md` ou depuis la revue.
- Modifier le code du repo.

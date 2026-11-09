---
name: scoping
description: Cadre un run — diff, stack, mode, hôte — et écrit context.json et diff.patch. Git et détection de fichiers, aucun appel de modèle.
user-invocable: false
---

# scoping

Entrée : repo cible, commande (`review` dans cette phase). Sortie : `context.json` et `diff.patch` dans `<repo>/.review/runs/<run-id>/`.

Le répertoire du plugin est deux niveaux au-dessus de ce fichier.

## Procédure

Lancer : `node <plugin>/scripts/scope.cjs <repo> --command review --host <hôte>`.

`--host` donne l'hôte de la session en cours (`mistral`, `copilot`, `claude`, `cursor`). La variable `CODE_CHECK_HOST`, si posée, l'emporte. L'hôte est noté dans `context.host` ; il ne change pas le diff.

Le script écrit sur stdout le chemin du dossier de run. Code 3 : afficher le message, s'arrêter, aucun dossier créé (c'est le cas sans `rules.yml`, hors dépôt git, ou avec un hôte indéterminé).

## Ce que le script décide

- Base : `main`, sinon `master`, sinon `HEAD~1`, sinon `HEAD`. Notée dans `diff.base`.
- Diff : `git diff <base>...HEAD` si la branche a des commits d'avance, sinon `git diff HEAD` (travail non commité). Patch écrit tel quel. Les fichiers non suivis par git n'y figurent pas (`git add -N` pour les inclure).
- Stack par présence de fichiers à la racine : `pom.xml` ou `build.gradle*` → `java` ; `package.json` → `node`.
- Mode : `fast` si 200 lignes modifiées ou moins et aucun fichier sous `.review/`, sinon `standard`. `deep` n'est jamais choisi ici.
- `axes` : `axes.review` de `rules.yml`, recopié tel quel (`simplicity` inclus depuis la 0.3.0).
- Le dossier sécurité n'est pas créé.

Ne pas relire ni « comprendre » le diff. Ne pas appeler de reviewer.

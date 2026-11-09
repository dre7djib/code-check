---
name: review
description: Commande review. En 0.1.0 (socle) : charge les règles, cadre le run, écrit context.json, diff.patch et summary.txt. Aucun reviewer.
disable-model-invocation: true
---

# review (socle)

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session.

## Procédure

1. Suivre la skill `rules-loader` sur le repo cible. Code 3 : afficher le message, sortir avec le code 3, ne rien créer.
2. Suivre la skill `scoping` (`--command review`, `--host` = hôte de la session). Elle crée `.review/runs/<run-id>/` avec `context.json` et `diff.patch`. Code 3 : idem.
3. Lancer `node <plugin>/scripts/write-summary.cjs <dossier-de-run>`. Il écrit `summary.txt` et l'affiche.
4. Afficher ce texte tel quel et s'arrêter. Code de sortie 0.

## Interdits

- Invoquer un reviewer ou un sous-agent.
- Écrire `REVIEW.md`.
- Créer `.review/<nom-du-repo>/runs/` à la racine du workspace.
- Modifier le code du repo.

## Sortie attendue

```
Revue de code   → <chemin>/review/REVIEW.md   non généré (socle)
Sécurité        → ignorée
Pistes croisées → 0
Hôte            → <context.host>
```

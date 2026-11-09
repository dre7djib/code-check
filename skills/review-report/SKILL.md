---
name: review-report
description: Produit REVIEW.md et REVIEW-DETAIL.md depuis merged.json, via scripts/build-report.cjs.
user-invocable: false
---

# Rapport de revue

Le répertoire du plugin est deux niveaux au-dessus de ce fichier.

Lancer : `node <plugin>/scripts/build-report.cjs <dossier-de-run>`. Le script fusionne (déterministe + axes), dédoublonne par `file:line` (sévérité la plus haute gardée, autres axes dans `also_flagged_by`), trie (sévérité, chemin, ligne), plafonne à `display.review_max_findings`, et écrit `review/merged.json`, `review/REVIEW.md`, `review/REVIEW-DETAIL.md`, `cross-hints.json`, `summary.txt`.

Ne pas réécrire ces fichiers à la main. Le rapport est en français, construit depuis `merged.json` seulement.

Structure de `REVIEW.md` : titre, ligne `Run <id> · mode <mode> · règles <sha court>`, sections Bloquants / À corriger / Suggestions (vides omises), puis « N findings affichés sur M. ». Zéro finding : le fichier contient « Aucun point. ». Aucune piste de sécurité n'y figure ; au plus la ligne « Des points ont été transmis au rapport sécurité. » sans chiffre.

Code de sortie du script : 1 s'il y a un bloquant, 2 si un axe manque et aucun bloquant, 0 sinon.

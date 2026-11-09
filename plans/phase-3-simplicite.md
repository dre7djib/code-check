# Phase 3 — Simplicité et économie de tokens

Durée : 3 à 4 jours. Ponytail devient le reviewer simplicité. Caveman compresse les échanges internes. Les rapports restent en français complet.

## Objectif

Ajouter l'axe `simplicity` sans rouvrir le débat sur les couches imposées, et mesurer les tokens avant et après Caveman sur le même jeu de tests. Aucune perte de finding attendu.

## Prérequis

- Phase 2 acceptée.
- Commit Ponytail et commit Caveman choisis et relus (licence, télémétrie, absence d'appel réseau dans les fichiers copiés). Le propriétaire nommé en phase 0 signe la ligne de `vendor-lock.md` avant la copie.
- Le jeu `eval/` de la phase 2 est vert.

## Hors périmètre

- Installer le CLI Caveman. La copie est la skill (fichiers Markdown), pas le binaire.
- Laisser Caveman reformuler `REVIEW.md`, `REVIEW-DETAIL.md`, ou quoi que ce soit côté sécurité.
- Activer la télémétrie. Si un fichier copié envoie un usage ou un mode « Auto » vers un service, il n'est pas copié. `DO_NOT_TRACK` n'est pas une parade suffisante pour un fichier qui phone home : on ne le prend pas.
- Demander à Ponytail de chercher des failles. Cet axe ignore la sécurité.

## Fichiers

```
skills/ponytail/SKILL.md          # copie figée au premier niveau de skills/
skills/caveman/SKILL.md           # copie figée de la skill, sans CLI
agents/review/simplicity.md
ai.mistral.vibe/agents/review-simplicity.toml
com.github.copilot/agents/review-simplicity.agent.md
vendor-lock.md                    # deux lignes complétées
```

Ponytail : copier la skill `ponytail-review` au commit relu, pas le dépôt entier si d'autres skills envoient des données. Noter le chemin d'origine et le SHA dans `vendor-lock.md`.

Caveman : copier uniquement les fichiers de skill nécessaires à compresser un texte (règles, message entre agents). Exclure hooks, télémétrie, et toute commande qui poste hors du poste. La liste des fichiers exclus est dans `vendor-lock.md`.

## Tâches

### 1. Reviewer simplicité

`agents/review/simplicity.md`, mêmes outils que les autres reviewers (`Read`, `Grep`, `Glob`).

Le prompt, dans cet ordre :

1. Charger la skill Ponytail vendored.
2. Coller les `architecture.layers` de ce run et la phrase : « Ces couches sont un ADR. Un port, un adapter ou une interface qui existe pour cette séparation n'est pas un finding. Ne pas proposer de les fusionner, de les supprimer, ni de les qualifier de sur-ingénierie. »
3. Restreindre Ponytail aux catégories lean : code mort, abstraction à une seule implémentation hors couches imposées, dépendance neuve pour quelques lignes, duplication qui doit changer ensemble. Les catégories bug, sécurité, charge et test manquant sont produites par d'autres axes : les jeter, ne pas les réécrire.
4. Sortie : tableau conforme au schéma revue, `axis: simplicity`, `source: agent`. Sévérité `suggestion` par défaut. `fix` seulement si le finding montre du code inatteignable dans le diff. Jamais `blocking` sur cet axe en v1.
5. Si Ponytail écrit quand même un point sécurité, le marquer `route: security` et ne pas lui donner de titre exploitable : `title` = « Piste transmise à la sécurité », `evidence` = chemin et ligne. Le détail utile au pipeline sécurité tient dans un champ qui ne sera pas rendu en revue ; comme le schéma revue interdit les champs libres, le détail va dans `cross-hints.json` écrit par l'orchestrateur à partir d'une ligne `hint` que le reviewer met dans un fichier séparé `simplicity-hints.json` (tableau `{ file, line, note }`). Ce fichier n'est pas un rapport. L'orchestrateur le fusionne dans `cross-hints.json` et ne le recopie pas dans `REVIEW.md`.

### 2. Dédoublonnage avec l'axe tests

Si l'axe `tests` est actif, tout finding Ponytail qui parle d'un test manquant est supprimé, même s'il a échappé au filtre du prompt. La suppression est une règle de l'orchestrateur, pas une espérance sur le modèle.

### 3. Caveman en interne

Deux usages, pas un troisième :

- Avant d'envoyer `rules.yml` à un reviewer, l'orchestrateur produit `context.rules.compact` via la skill Caveman. Le reviewer simplicité reçoit le compact et le YAML original des couches seulement (les couches ne passent pas par la compression : une couche effacée par un résumé serait une faille du garde-fou).
- Entre l'orchestrateur et le directeur (phase 5), le compte-rendu d'axe est compact. En phase 3, le directeur n'existe pas encore : écrire le compact à côté du JSON brut dans `review/findings/<axis>.compact.txt` pour mesurer, et continuer à fusionner depuis le JSON brut.

Interdit : passer `REVIEW.md` dans Caveman. Le skill `review-report` lit `merged.json` et rédige en phrases complètes.

### 4. Mesure

Script `scripts/measure-tokens.sh` qui ne parle à aucun réseau.

Sur le jeu `eval/` figé :

- Run A : orchestrateur avec envoi du `rules.yml` intégral, Caveman désactivé. Enregistrer la taille en caractères des messages écrits dans `review/trace/` (l'orchestrateur y copie le prompt envoyé à chaque reviewer, pas la réponse du modèle).
- Run B : mêmes cas, règles compactées.
- Estimer les tokens par `caractères / 4`. Le noter comme estimation, à côté du chiffre d'usage si l'hôte l'affiche. Ne pas inventer un appel d'API. Refaire la paire A/B sur chaque hôte installé : un gain sur un seul hôte ne suffit pas.
- Comparer les `id` de findings attendus (phase 7). Un id attendu absent du run B est un échec, même si les caractères ont baissé.

Écrire le résultat dans `eval/token-report.md` : caractères A, caractères B, ratio, findings perdus. Ce fichier est commité. Il ne contient pas de code source des pilotes.

## Acceptation

1. Le cas planté « port hexagonal signalé à tort » ne produit pas de finding. Le fabriquer dans `eval/` : une interface `domain` et un adapter qui l'implémente, conformes à `rules.yml`, sans autre défaut. `merged.json` ne contient aucun `axis: simplicity` sur ces fichiers.
2. Le cas planté « abstraction inutile hors ADR » produit un finding `simplicity`. Exemple : une factory à une implémentation, aucun lien avec les couches.
3. Les findings des phases 2 (architecture, nommage, tests, erreurs) sont tous encore là sur le jeu `eval/`.
4. `eval/token-report.md` montre une baisse de caractères sur les prompts de règles. Pas de seuil magique : la baisse doit être réelle et les findings attendus identiques.
5. `vendor-lock.md` a les deux SHA. Aucun binaire Caveman dans le dépôt (`find . -name caveman -o -name 'caveman-*'` ne remonte que des markdown).
6. Version `0.3.0`.

## Risques propres

| Risque | Parade |
|---|---|
| Ponytail et l'axe tests se répètent | Règle d'orchestrateur, testée par un cas `eval/` qui n'a qu'un test manquant : un seul finding, `axis: tests`. |
| La compression efface une couche | Les couches sont passées à part, non compressées. Un test relit le prompt archivé dans `review/trace/` et échoue si le nom d'une couche de `rules.yml` en est absent. |
| Fichier Caveman qui phone home | Exclu à la copie. La revue du diff vendor est une ligne de la checklist de tag, faite par le propriétaire nommé en phase 0. |

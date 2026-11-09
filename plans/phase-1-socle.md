# Phase 1 — Socle

Durée : 5 jours. Le plugin s'installe sur chaque hôte. La commande `review` termine sans reviewer, avec un `context.json` valide. Le scénario est rejoué sur chaque hôte installé sur le poste.

## Objectif

Poser le manifeste Agent Plugins 1.0, l'adaptateur de chaque hôte, le canal d'installation de chacun, et les skills de cadrage. Aucun jugement de code dans cette phase.

## Prérequis

- Note de cadrage signée (phase 0), avec l'endpoint de chaque hôte installé.
- Les hôtes présents sur la machine de développement. Un hôte absent ne dispense pas d'écrire son adaptateur.
- [00-conventions.md](00-conventions.md) lu.

## Hors périmètre

- Reviewers, orchestrateurs, script déterministe, Ponytail, Caveman, skill Cloudflare.
- Hook pre-push.
- Écriture de `REVIEW.md`.
- Démontrer le socle sur un seul hôte.

## Fichiers à créer

```
plugin.json
skills/scoping/SKILL.md
skills/rules-loader/SKILL.md
skills/review/SKILL.md
ai.mistral.vibe/agents/director.toml
com.github.copilot/agents/director.agent.md
.claude-plugin/plugin.json
.cursor-plugin/plugin.json
cursor/agents/director.md
schemas/review-findings.schema.json
schemas/security-findings.schema.json
templates/rules.example.yml
vendor-lock.md
CHANGELOG.md
README.md
```

`.claude-plugin/plugin.json` a le même `name` et la même `version` que la racine. `.cursor-plugin/plugin.json` aussi, plus le champ `agents` égal à `cursor/agents`. Ni l'un ni l'autre ne devient le manifeste de référence : la racine reste le schéma 1.0.0.

`schemas/security-findings.schema.json` n'est pas inventé ici comme schéma de findings. Le schéma des findings sécurité est celui de Cloudflare, copié en phase 4 dans `skills/security-audit/`. Le fichier de cette phase est le résumé que le directeur a le droit de voir (`confirmed`, `needs_validation`, `rejected`, `status`). Le `$id` du schéma dit `security-summary`. Une ligne en tête du fichier l'explique.

Les skills sont des dossiers directs de `skills/`. Pas de `skills/shared/`.

## Tâches

### 1. Manifeste

`plugin.json` à la racine :

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "code-check",
  "version": "0.1.0",
  "description": "Revue de code et revue de sécurité séparées, sur les postes de développement.",
  "license": "UNLICENSED",
  "author": { "name": "code-check" },
  "keywords": ["review", "security"],
  "extensions": {
    "ai.mistral.vibe": {
      "schemaVersion": 1,
      "displayName": "code-check",
      "toolNamespace": "code_check"
    }
  }
}
```

Aucun autre champ au premier niveau. Vibe rejette le plugin sinon. `version` est posée pour que les postes ne suivent pas la branche. `toolNamespace` est `code_check` parce que le préfixe Vibe n'accepte pas le tiret.

Chaque adaptateur (Vibe, Copilot, Claude, Cursor) dit seulement : lire `agents/director.md` (fichier créé en phase 5 ; en phase 1 le corps tient en trois lignes « lancer la skill review et s'arrêter »), ne pas modifier le code. Les noms d'outils viennent du tableau des conventions, vérifiés contre la doc de l'hôte installé. Si le nom d'outil a changé, on corrige l'adaptateur, pas la skill.

### 2. Skill `rules-loader`

Fichier : `skills/rules-loader/SKILL.md`. `name: rules-loader`. `user-invocable: false`.

Entrée : chemin du repo cible. Sortie : objet règles normalisé, ou une erreur de code 3.

Comportement :

- Lire `.review/rules.yml`. Absent ou illisible : arrêt, message « rules.yml manquant », code 3.
- `version` doit être `1`.
- Vérifier la présence de `architecture.layers`, `naming`, `axes.review`, `thresholds.security_confirmed_min_severity`.
- Calculer le SHA-256 du fichier. Le mettre dans `context.json` sous `rules_sha256`.
- Ne pas interpréter les règles. Ne pas lancer d'outil.

Le corps de la skill contient le tableau des champs de [00-conventions.md](00-conventions.md) et un exemple minimal tiré de `templates/rules.example.yml`.

### 3. Skill `scoping`

Fichier : `skills/scoping/SKILL.md`. `name: scoping`. `user-invocable: false`. Le champ `context.host` vaut `mistral`, `copilot`, `claude` ou `cursor`, lu depuis l'environnement `CODE_CHECK_HOST` ou, à défaut, depuis l'outil qui a lancé la session. Il est noté, il ne change pas le diff.

Entrée : repo cible, commande (`review` dans cette phase). Sortie : `context.json` et `diff.patch` dans `.review/runs/<run-id>/`.

Comportement :

- Base du diff : `main` si elle existe, sinon `master`, sinon le dernier commit. Documenter le choix dans `context.json` (`diff.base`).
- `git diff <base>...HEAD` s'il y a des commits, sinon `git diff` (travail non commité). Écrire le patch tel quel.
- Détecter la stack par présence de fichiers, pas par le README : `pom.xml` ou `build.gradle` → `java` ; `package.json` → `node` ; les deux peuvent coexister.
- Choisir le mode : `fast` si le diff fait 200 lignes ou moins et ne touche pas `.review/`, sinon `standard`. `deep` n'est jamais choisi ici.
- Créer le dossier de run. Ne pas créer le dossier sécurité.
- Écrire `context.json` selon la forme de [00-conventions.md](00-conventions.md). `axes` recopie `rules.yml` `axes.review` en filtrant `simplicity` (pas encore branché).

La skill n'appelle pas de modèle pour « comprendre » le diff. C'est du git et de la détection de fichiers.

### 4. Schéma revue

`schemas/review-findings.schema.json` : JSON Schema draft 2020-12, un objet finding comme dans les conventions, `additionalProperties: false`. Un second schéma, `review-findings-file.schema.json`, décrit le tableau. Un test Node sans dépendance, `scripts/validate-review-findings.cjs`, charge le schéma avec une implémentation minimale maison ou `node:assert` sur les champs requis si on ne veut pas de dépendance. Préférer un validateur zéro dépendance qui vérifie les champs requis, les enums et le rejet de `..` dans `file`. Les cas limites du schéma Cloudflare ne sont pas à réinventer : ce validateur couvre la revue seulement.

Cas de test du validateur, dans `scripts/validate-review-findings.test.cjs`, lancés par `node --test` :

- objet complet accepté ;
- `severity` inconnue refusée ;
- `file` égal à `../secret` refusé ;
- propriété supplémentaire refusée ;
- `route: security` accepté.

### 5. Schéma résumé sécurité

`schemas/security-findings.schema.json` décrit uniquement :

```json
{
  "confirmed": 0,
  "needs_validation": 0,
  "rejected": 0,
  "cross_hints": 0,
  "status": "ok"
}
```

`status` : `ok`, `failed`, `skipped`. Entiers ≥ 0. Rien d'autre.

### 6. Commande vide

`skills/review/SKILL.md`, `name: review`, `disable-model-invocation: true`. Elle charge scoping et rules-loader, écrit le run, n'invoque aucun reviewer, écrit `summary.txt` :

```
Revue de code   → <chemin>/REVIEW.md   non généré (socle)
Sécurité        → ignorée
Pistes croisées → 0
Hôte            → <context.host>
```

Code de sortie 0 si le contexte est écrit, 3 sinon. La commande affiche ce texte et s'arrête.

### 7. Installation

Tag `v0.1.0` de ce dépôt, le même pour chaque hôte :

- Vibe : le dépôt est placé là où l'admin ou le poste charge les plugins (`~/.vibe/plugins/code-check` ou le chemin d'organisation noté en phase 0). `/plugins` liste `code-check`. La commande relevée (attendue : `/code_check:review`) est écrite dans le README.
- Copilot : installation depuis le git tag par la CLI, le marketplace d'organisation, ou l'extension déjà présente dans Cursor. L'écran des plugins liste le skill `review`. Le préfixe réel est écrit dans le README.
- Claude Code : `--plugin-dir` sur ce dépôt, même scénario.
- Cursor : le plugin est chargé depuis le tag. Le préfixe réel est écrit dans le README.

Le README dit la commande réelle de chaque hôte, l'emplacement de `rules.yml`, et ce que la 0.1.0 ne fait pas.

### 8. Vendor lock et changelog

`vendor-lock.md` : tableau vide avec les colonnes origine, commit, licence, date, relecteur. Mentionner les trois composants prévus (Ponytail MIT, Caveman Apache-2.0, Cloudflare security-audit MIT) et la ligne « non copié ».

`CHANGELOG.md` : entrée `0.1.0` = socle, commande review vide.

`templates/rules.example.yml` : copie conforme du modèle des conventions, y compris `security.access`.

## Acceptation

1. `plugin.json` ne contient aucun champ hors schéma 1.0.0. Chaque hôte installé charge le plugin. Un rejet de manifeste bloque la phase. L'adaptateur d'un hôte absent du poste est dans le tag.
2. `node --test scripts/validate-review-findings.test.cjs` sort 0.
3. Sur un repo pilote avec `rules.yml` v0, la commande `review` lancée sur chaque hôte installé crée `.review/runs/<id>/context.json` et `diff.patch`, affiche la synthèse avec le bon `Hôte`, n'écrit pas de `REVIEW.md`, ne crée pas `.review/<nom-du-repo>/runs/` à la racine du workspace.
4. Dans un repo sans `rules.yml` : code 3, aucun dossier de run. Vérifié sur chaque hôte installé.
5. Le plugin installé depuis le tag `v0.1.0`, pas depuis une branche, se comporte comme en 3 sur chaque hôte installé.

## Risques propres

| Risque | Parade |
|---|---|
| Le préfixe diffère d'un hôte à l'autre | Le README recopie chaque chaîne observée. Les plans parlent de la commande `review`, pas d'un préfixe inventé. |
| Le format de plugin Vibe est encore marqué expérimental | On épingle la version de Vibe utilisée pour l'acceptation dans le changelog. Un bump d'hôte qui casse le chargement est un incident de socle, pas une occasion de fork le format. |
| Copilot cloud envoie le repo à GitHub | Cette surface reste hors poste, comme la note de cadrage. L'essai se fait sur les agents locaux. |

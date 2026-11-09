# Phase 2 — Revue de code MVP

Durée : 7 à 8 jours. Sur les deux pilotes, la commande `review` produit un `REVIEW.md` en quelques minutes, sans doublon `fichier:ligne`, sur chaque hôte installé.

## Objectif

Enchaîner les checks déterministes puis quatre reviewers isolés (architecture, nommage, tests, erreurs), et consolider un rapport plafonné. Le jeu d'évaluation de la phase 7 démarre le même jour que le premier reviewer : le premier cas planté (import interdit) doit être détecté avant de passer au reviewer suivant.

## Prérequis

- Phase 1 acceptée, tag `v0.1.0` posé.
- `rules.yml` v0 sur les deux pilotes.
- Java : ArchUnit déjà une dépendance de test du pilote hexagonal, ou accord pour l'ajouter dans ce repo pilote (pas dans le plugin).
- Node, si le second pilote est Node : `dependency-cruiser` déclarable en devDependency du pilote.

Le plugin n'embarque pas ArchUnit ni dependency-cruiser. Il les lance s'ils sont déjà invocables dans le repo. Un outil absent est un skip noté dans `deterministic/raw/skipped.txt`, pas un échec.

## Hors périmètre

- Simplicité, Ponytail, Caveman.
- Sécurité, directeur, `/check`, hook.
- Correctifs automatiques (`/review-fix` attend la phase 8).
- Axes de la section 9 du plan v1.

## Fichiers à créer

```
agents/review/orchestrator.md
agents/review/architecture.md
agents/review/naming.md
agents/review/tests.md
agents/review/errors.md
skills/architecture-rules/SKILL.md
skills/naming-conventions/SKILL.md
skills/review-contract/SKILL.md
skills/review-report/SKILL.md
scripts/run-deterministic.sh
ai.mistral.vibe/agents/review-architecture.toml
ai.mistral.vibe/agents/review-naming.toml
ai.mistral.vibe/agents/review-tests.toml
ai.mistral.vibe/agents/review-errors.toml
ai.mistral.vibe/agents/review-orchestrator.toml
com.github.copilot/agents/review-architecture.agent.md
com.github.copilot/agents/review-naming.agent.md
com.github.copilot/agents/review-tests.agent.md
com.github.copilot/agents/review-errors.agent.md
com.github.copilot/agents/review-orchestrator.agent.md
```

Chaque adaptateur pointe vers le `agents/review/*.md` du même rôle et ne recopie pas la procédure. `skills/review/SKILL.md` appelle l'orchestrateur au lieu de s'arrêter après le cadrage.

## Périmètre exclusif des reviewers

| Agent | Signale | Ne signale pas |
|---|---|---|
| `architecture` | Import interdit, dépendance de couche interdite, framework dans `domain` | Nommage, tests, style de catch |
| `naming` | Suffixe ou préfixe exigé par `naming[]` | Le fait qu'une classe soit « mal placée » |
| `tests` | Logique risquée changée (`tests.risky_paths`) sans test qui échouerait si elle cassait | Couverture, style de test, tests jugés trop nombreux |
| `errors` | Catch vide, erreur ignorée, retour d'erreur non testé sur le diff | Injection, secrets, validation métier |

Un finding hors axe est un défaut du prompt, pas un apport. L'orchestrateur le supprime et incrémente `écarts schéma` s'il est invalide, ou `hors axe` s'il est valide mais `axis` ne correspond pas à l'agent.

## Tâches

### 1. Script déterministe

`scripts/run-deterministic.sh <context.json> <out-dir>`.

- Lire `context.json`. Stack inconnue : écrire `skipped.txt` et sortir 0.
- Java : si une classe de test dont le nom contient `Architecture` existe, lancer le test (`mvn -q -DskipITs test -Dtest='*Architecture*'` ou l'équivalent Gradle). Capturer stdout. Un échec Maven n'est pas un échec du script : parser la sortie, produire un finding par violation, `source: archunit`, `axis: architecture`, `severity: blocking`, `rule` = nom du test.
- Node : si `dependency-cruiser` est dans les `devDependencies` et qu'un fichier de config existe à la racine ou dans `.review/`, le lancer en JSON. Chaque violation devient un finding `source: dependency-cruiser`. Sans config, skip : le plugin n'écrit pas de config dependency-cruiser à la place de l'équipe.
- Dépendances : `mvn dependency:tree` ou `npm ls --json`. Version non épinglée (plage `^` ou `+`) et licence absente ou non dans une allowlist éventuelle de `rules.yml` → finding revue `severity: suggestion`, `source: dependency-audit`. CVE → `security-seeds.json` uniquement, un objet `{ file, line, title, evidence }` sans détail d'exploitation au-delà du nom de l'avis.
- Secrets : si `gitleaks` est sur le PATH, le lancer sur le diff. Toute fuite va dans `security-seeds.json`, jamais dans `review-findings.json`. `gitleaks` absent : skip noté. Pas de détecteur maison.
- Linter : s'il y a une cible déjà scriptée (`npm run lint`, `mvn checkstyle:check`) et qu'elle finit en moins de 60 secondes, capturer les violations de nommage uniquement quand la règle cite un id présent dans `rules.yml`. Sinon skip. Ne pas ajouter de config de linter dans le repo pilote depuis le plugin.
- Écrire `review-findings.json` (tableau, schéma revue) et `security-seeds.json`.
- Sortie 0 si le script a fini, y compris avec des tests ArchUnit rouges. Sortie 3 si `context.json` est illisible. Sortie 1 seulement si le script a une erreur interne (bash `set -euo pipefail` sur sa propre logique, pas sur les outils).

### 2. Skills de règles

`architecture-rules` : comment lire `architecture.layers` et `forbidden_imports`, et la phrase d'interdiction : « les couches listées sont imposées, ne pas proposer de les fusionner ou de les supprimer ».

`naming-conventions` : comment lire `naming[]`. Une règle `when_annotation` ne s'applique que si l'annotation est présente sur le type touché. Pas d'invention de suffixe hors fichier.

`review-contract` : le schéma, la liste des axes, l'ordre de sévérité, le fait qu'un finding sans `file` et `line` n'existe pas.

`review-report` : produire `REVIEW.md` et `REVIEW-DETAIL.md` en français, depuis `merged.json` seulement. Structure du rapport :

```
# Revue de code
Run <id> · mode <mode> · règles <rules_sha256 court>

## Bloquants
## À corriger
## Suggestions

N findings affichés sur M. Le détail est dans REVIEW-DETAIL.md.
```

Plafond : `display.review_max_findings`. Les sections vides sont omises. Zéro finding : le fichier contient « Aucun point. » et rien d'autre. Aucune piste sécurité, aucune phrase du type « faille possible ». Si `cross-hints.json` ou `security-seeds.json` est non vide, une seule ligne en bas : « Des points ont été transmis au rapport sécurité. » sans nombre si la commande est `/review` (le développeur n'a pas forcément le droit sécurité). Le compteur précis est réservé au directeur, phase 5. En phase 2, la ligne est présente ou absente, sans chiffre.

### 3. Reviewers

Un fichier agent par axe, outils `Read`, `Grep`, `Glob` seulement.

Entrée imposée par l'orchestrateur : chemins de `context.json`, `rules.yml`, `diff.patch`, et du fichier de sortie. Sortie : un tableau JSON et aucune prose. Findings déjà produits par le script déterministe sur le même `rule` et la même ligne : ne pas les répéter. Le reviewer architecture confirme ou abandonne un finding ArchUnit seulement s'il peut montrer que la ligne citée n'existe pas ; il ne « réinterprète » pas une violation réelle pour la rendre plus douce.

Sévrité par défaut si la règle ne la donne pas :

| Axe | Défaut |
|---|---|
| architecture | `blocking` |
| naming | valeur de la règle, sinon `fix` |
| tests sur `risky_paths` | valeur de `tests.severity_if_missing`, sinon `fix` |
| tests hors `risky_paths` | `suggestion` |
| errors | valeur de `errors.severity`, sinon `fix` |

Chaque finding d'agent a `source: agent` et un `evidence` qui cite le code vu, pas une reformulation.

### 4. Orchestrateur

`agents/review/orchestrator.md`.

Ordre, non négociable :

1. Skills scoping et rules-loader (déjà faites si `context.json` existe pour ce run).
2. `scripts/run-deterministic.sh`.
3. Lancer les reviewers des axes actifs en parallèle, un agent par axe, contexte limité aux quatre chemins. Ne pas leur passer `review-findings.json` : ils le retrouveraient et commenteraient les autres axes. L'orchestrateur fusionne après.
4. Valider chaque fichier avec `scripts/validate-review-findings.cjs`.
5. Fusionner déterministe + agents. Dédoublonner selon [00-conventions.md](00-conventions.md).
6. Écrire `merged.json`, les deux markdown, `cross-hints.json` (peut être `[]`).
7. Écrire `summary.txt` avec les compteurs revue seulement.

Échec d'un reviewer : les autres comptent. Le rapport mentionne l'axe manquant en tête. Code 2 si aucun bloquant n'a été produit, code 1 si un bloquant l'a été.

Budget : couper au `max_minutes` du mode. Ce qui est déjà écrit est rendu.

### 5. Premiers cas plantés

Avant de déclarer la phase finie, ajouter dans `eval/` (détaillé en phase 7) au minimum :

- un mini-repo Java dont `domain` importe `org.springframework.stereotype.Service` ;
- un service annoté `@Transactional` dont le nom ne finit pas par `Transactional` ;
- un changement de règle métier sans test ;
- un `catch (Exception e) {}`.

Lancer `review` dessus, une fois par hôte installé. Les quatre doivent apparaître, un par axe, sans doublon.

## Acceptation

1. Les deux pilotes produisent un `REVIEW.md` en moins de 15 minutes en mode standard, sur une PR réelle de taille moyenne (moins de 400 lignes), lancée sur chaque hôte installé.
2. Aucune clé `fichier:ligne` n'apparaît deux fois dans `merged.json`.
3. Un finding déterministe ArchUnit (ou dependency-cruiser) est repris tel quel : même fichier, même ligne, sévérité `blocking`.
4. Les quatre cas plantés sont détectés. Le rapport du mini-repo ne contient pas les mots « CVE », « secret », « injection ».
5. Chaque hôte charge encore le plugin après l'ajout des adaptateurs. Version `0.2.0`, changelog, tag.

## Risques propres

| Risque | Parade |
|---|---|
| ArchUnit absent du pilote | Skip visible dans le rapport (« architecture déterministe non exécutée »). Le reviewer agent reste, mais la phase n'est pas acceptée sur le pilote hexagonal tant que le test ArchUnit n'existe pas. L'ajout du test se fait dans le repo pilote, par son équipe. |
| Le reviewer architecture conteste l'hexagonal | La skill `architecture-rules` est dans son message. Un finding « trop de couches » est un échec de revue du prompt, retiré avant acceptation. |
| Bruit des linters | Ne mapper que les règles citées par `rules.yml`. Le reste reste dans `raw/` et n'entre pas dans le rapport. |

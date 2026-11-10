# Phase 5 — Directeur et `/check`

Durée : 3 à 4 jours. Une commande lance les deux pipelines, rend deux rapports séparés, et n'imprime que des compteurs.

## Objectif

La commande `check` cadre une fois, lance la revue et la sécurité fast, route les pistes croisées, et sort avec le bon code. Chaque pipeline reste lisible seul si l'autre tombe. Les deux pipelines partent en parallèle quand l'hôte sait déléguer deux contextes à la fois. Sinon ils s'enchaînent, chacun dans un contexte neuf, et `summary.txt` le dit (`pipelines séquentiels`). Le deep n'est pas concerné : sans parallélisme, il reste interdit.

## Prérequis

- Phases 2 et 4 acceptées.
- Conventions de codes de sortie et de budget dans [00-conventions.md](00-conventions.md).

## Hors périmètre

- Mode deep (phase 6). Le directeur `check` refuse un argument deep avec le message « utiliser check-deep ou security-deep », il ne le simule pas. La commande `check-deep` (directeur-deep) lance revue + deep.
- Fusion des deux rapports dans un seul markdown.
- Donner au directeur les `title` ou les `quote` de la sécurité.

## Fichiers

```
agents/director.md
skills/check/SKILL.md
skills/security/SKILL.md          # branche l'orchestrateur sécurité, sans revue
ai.mistral.vibe/agents/director.toml
com.github.copilot/agents/director.agent.md
```

`skills/scoping` existe déjà : pour `check`, le directeur est son seul appelant. Les commandes `review` et `security` restent des entrées directes. Elles ne passent pas par le directeur. Seule `check` le fait. Ainsi un poste sans droit pratique sur le dossier sécurité peut continuer à lancer la revue.

## Tâches

### 1. Cadrage unique

Le directeur appelle scoping + rules-loader une fois. Il passe le même `context.json` aux deux orchestrateurs. Interdit : chaque orchestrateur recalcule un diff différent. Si le diff change pendant le run (nouveau commit), on l'ignore : le patch déjà écrit fait foi, une ligne de `summary.txt` le dit.

Le choix de mode suit le tableau des conventions. `/check` ne lance pas le deep.

### 2. Lancement parallèle

Un seul message du directeur, deux délégations :

- orchestrateur revue, avec le chemin du run ;
- orchestrateur sécurité, avec le même run et le dossier `.review/<nom-du-repo>/runs/`.

La sécurité démarre sans attendre la fin de la revue. Les pistes croisées ne sont pas connues au départ : la sécurité fait un premier passage sur le diff et les seeds déterministes. Quand la revue a écrit `cross-hints.json`, le directeur relance uniquement l'étape « candidats issus des pistes » de l'orchestrateur sécurité (pas tout le pipeline). Si cette seconde passe dépasse le budget restant, les pistes restent en file `needs_validation` avec le bloqueur « budget atteint avant vérification », et elles comptent dans le résumé.

### 3. Échecs indépendants

| Situation | Revue | Sécurité | Code |
|---|---|---|---|
| Les deux finissent, rien de bloquant | rapport | rapport | 0 |
| Bloquant revue, sécurité ok | rapport | rapport | 1 |
| Sécurité `confirmed` ≥ seuil, revue propre | rapport | rapport | 1 |
| Sécurité en timeout, revue propre | rapport | `status: failed` | 2 |
| Sécurité en timeout, revue bloquante | rapport | `status: failed` | 1 |
| Revue en erreur, sécurité ok | mention d'axe ou de pipeline manquant | rapport | 2, ou 1 si un `confirmed` dépasse le seuil |

Le seuil se lit dans `thresholds.security_confirmed_min_severity`. Un `needs_validation` ne bloque jamais le code de sortie en v1. Un `confirmed` sous le seuil est compté, non bloquant, et visible dans le résumé par son nombre seul.

`summary.txt` et le terminal, et seulement eux :

```
Revue de code   → <chemin REVIEW.md>     2 bloquants · 5 à corriger · 8 suggestions
Sécurité        → <dossier restreint>    1 confirmed · 2 needs_validation
Pistes croisées → 1 transmise à la sécurité
```

Si un pipeline manque, la ligne le dit : `Sécurité → échec (délai), pas de rapport`. Pas de raison détaillée qui citerait un fichier vulnérable.

### 4. Droits

Le directeur lit `summary.json` sécurité et rien d'autre dans ce dossier. Test : le prompt du directeur et un contrôle du script de run. `scripts/assert-director-blind.sh` parcourt `review/trace/` du directeur et échoue si une `quote` de `findings.json` s'y trouve.

Le schéma Agent Plugins n'a pas de `userConfig`, et on n'en ajoute pas dans `plugin.json`. La clé est `security.access` dans `rules.yml` du repo : `none`, `fast` ou `deep`.

`review` ignore cette clé. `security` et `check` exigent au moins `fast`. `security-deep` exige `deep`, sinon message et code 3, sans démarrer de chasseur. Ce n'est pas un contrôle par personne : c'est la politique du repo. Pour retirer la commande à un groupe, la config d'administration de l'hôte désactive la skill. La barrière qui compte reste le dossier `.review/<nom-du-repo>/runs/` en `0700`, gitignoré.

### 5. Budgets

Le directeur passe `max_minutes` et une heure de début. Chaque orchestrateur s'arrête de lui-même. Le directeur, de son côté, n'attend pas au-delà de `max_minutes` + 1 minute : il rend alors l'autre rapport et marque l'absent `failed`.

Pas de compteur de tokens fiable côté script : si la session expose un usage, l'orchestrateur l'écrit dans `usage.json` du run (nombres seuls). S'il dépasse `max_tokens`, il s'arrête comme pour le délai. Si l'usage n'est pas exposé, la limite de temps est le seul coupe-circuit, et `usage.json` le dit (`tokens: unknown`).

## Acceptation

1. Sur le fixture qui a à la fois un import interdit et le SQL planté : deux rapports, `REVIEW.md` sans la citation SQL, résumé conforme à l'exemple, code 1.
2. Tuer l'orchestrateur sécurité (timeout forcé à 1 seconde dans un test) : `REVIEW.md` présent, ligne sécurité en échec, code 1 si la revue est bloquante, sinon 2.
3. `assert-director-blind.sh` et `assert-review-has-no-security.sh` passent.
4. `review` seule ne crée pas `.review/<nom-du-repo>/runs/` à la racine du workspace. Vérifié sur chaque hôte installé.
5. Version `0.5.0`.

## Risques propres

| Risque | Parade |
|---|---|
| Le second passage des pistes croisées double le coût | Il ne reprend que les hints, pas le diff déjà chassé. Budget restant vérifié avant l'appel. |
| Le directeur « résume » un finding en voulant aider | Le prompt interdit toute reformulation. Le test de cécité compare aux citations réelles du fixture. |
| `security.access` pris pour un vrai verrou par personne | README : la garantie est le dossier `.review/<nom-du-repo>/runs/` en `0700` et gitignoré, et le fait que `review` ne lance pas la sécurité. |

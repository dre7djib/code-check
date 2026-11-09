---
name: review-contract
description: Contrat des findings de revue — schéma, axes, ordre de sévérité. Chargé par chaque reviewer et par l'orchestrateur.
user-invocable: false
---

# Contrat des findings

Un fichier d'axe est un **tableau JSON** de findings, rien d'autre : pas de prose, pas de markdown. Schéma : `schemas/review-findings.schema.json` (`additionalProperties: false`).

| Champ | Règle |
|---|---|
| `id` | `[a-z0-9-]+:[a-z0-9-]+`, unique dans le run (par exemple `architecture:domain-imports-spring`) |
| `axis` | l'axe du reviewer, pas un autre |
| `severity` | `blocking` > `fix` > `suggestion` |
| `file` | chemin relatif au repo, sans `..`, sans chemin absolu |
| `line` | entier ≥ 1 |
| `title` | une phrase, sans procédure d'exploitation |
| `evidence` | citation du code vu, pas une reformulation |
| `rule` | id de règle de `rules.yml` ou nom du test |
| `source` | `agent` pour un reviewer |
| `route` | optionnel, seule valeur : `security` |

Axes : `architecture`, `naming`, `tests`, `errors` (`simplicity` : phase 3).

Un finding sans `file` et `line` n'existe pas : ne pas le produire. Aucun finding : `[]`.

`route: security` : un indice de sécurité aperçu hors de son axe. Le finding quitte la revue et n'apparaît dans aucun rapport de revue. Ne jamais écrire de détail d'exploitation.

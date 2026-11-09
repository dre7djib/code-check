---
name: rules-loader
description: Charge et valide .review/rules.yml du repo cible, calcule son SHA-256. N'interprète pas les règles.
user-invocable: false
---

# rules-loader

Entrée : chemin du repo cible. Sortie : objet règles normalisé, ou arrêt avec le code 3.

Le répertoire du plugin est deux niveaux au-dessus de ce fichier.

## Procédure

1. Lancer : `node <plugin>/scripts/load-rules.cjs <repo>`.
2. Code 0 : le JSON affiché est l'objet règles (`axes_review`, `security_confirmed_min_severity`, `sha256`). Le `sha256` va dans `context.json` sous `rules_sha256`.
3. Code 3 : afficher le message de l'erreur (par exemple « rules.yml manquant ») et s'arrêter. Ne créer aucun dossier de run.

Ne pas interpréter les règles. Ne lancer aucun autre outil.

## Contrôles

| Champ | Exigence |
|---|---|
| `version` | `1` |
| `architecture.layers` | présent |
| `naming` | présent |
| `axes.review` | liste non vide |
| `thresholds.security_confirmed_min_severity` | `low`, `medium`, `high` ou `critical` |

Les autres champs (`tests`, `errors`, `budgets`, `display`, `security`, `pre_push`) sont lus par les phases suivantes. Le contrat complet est dans `00-conventions.md` du dépôt du plugin.

## Exemple minimal

Extrait de `templates/rules.example.yml` :

```yaml
version: 1
architecture:
  layers:
    - name: domain
      paths: ["**/domain/**"]
      may_import: []
naming:
  - id: transactional-service
    include: ["**/*Service.java"]
    suffix: Transactional
    severity: fix
axes:
  review: [architecture, naming, errors]
thresholds:
  security_confirmed_min_severity: high
```

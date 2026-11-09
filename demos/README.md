# Projets démo

Deux applications fictives, petites et compilables, pour travailler sur `code-check` sans repo d'entreprise. Elles tiennent le rôle des deux pilotes de la phase 0 : même forme d'architecture, stacks différentes, `rules.yml` propre à chacune.

| Démo | Stack | Architecture | Rôle |
|---|---|---|---|
| [billing-hex](billing-hex/README.md) | Java 17, Maven, ArchUnit | Hexagonale `domain` / `application` / `adapters` | Pilote hexagonal |
| [catalog-node](catalog-node/README.md) | TypeScript, dependency-cruiser | Mêmes couches, autres chemins | Second pilote, pour vérifier que les règles ne sont pas en dur dans le plugin |

Ce ne sont pas les fixtures d'évaluation. Celles de la phase 7 restent des mini-repos d'un seul défaut, sous `eval/fixtures/`, écrits plus tard. Ici chaque démo mélange du code conforme et plusieurs défauts, comme une PR réelle.

Les défauts sont du code ordinaire. Aucun commentaire ne les étiquette : un reviewer qui ne les trouve qu'en lisant un marqueur ne compte pas.

`.review/runs/` est ignoré par git dans chaque démo. `.review/rules.yml` est le fichier de règles v0, à faire relire comme en phase 0.

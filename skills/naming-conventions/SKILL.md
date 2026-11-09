---
name: naming-conventions
description: Lire naming[] de rules.yml pour la revue de nommage.
user-invocable: false
---

# Conventions de nommage

Chaque entrée de `naming[]` : `id`, `include` (globs), `when_annotation` (optionnel), `suffix` ou préfixe exigé, `severity`.

- Une règle s'applique aux fichiers qui matchent `include` **et** touchés par le diff.
- `when_annotation` : la règle ne s'applique que si l'une de ces annotations est présente sur le type du fichier (nom simple ou nom qualifié). Annotation absente : la règle ne s'applique pas.
- Le nom du type doit se terminer par `suffix`. S'il ne le fait pas : un finding, `rule` = l'`id` de la règle, `severity` = celle de la règle (sinon `fix`).
- Ne pas inventer de suffixe, de préfixe ou de convention absents du fichier. Ne pas dire qu'une classe est « mal placée ».
- Un fichier dont le nom ne matche pas `include` n'est pas sélectionné par la règle, même s'il porte l'annotation.

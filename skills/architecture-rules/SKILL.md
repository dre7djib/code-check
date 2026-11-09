---
name: architecture-rules
description: Lire architecture.layers et forbidden_imports de rules.yml pour la revue d'architecture.
user-invocable: false
---

# Règles d'architecture

**Les couches listées dans `architecture.layers` sont imposées. Ne pas proposer de les fusionner ou de les supprimer. Ne jamais qualifier une couche, un port ou un adapter listé de sur-ingénierie.**

## Lecture de `rules.yml`

- `architecture.layers[]` : `name`, `paths` (globs relatifs au repo), `may_import` (couches autorisées). Un fichier appartient à la couche dont un glob le couvre. Un fichier sous aucune couche (par exemple `support/`) est hors règle d'import de couche.
- Une couche n'importe que les couches de `may_import` (et elle-même). Tout autre import d'une couche listée est une violation.
- `architecture.forbidden_imports[]` : `from` (glob) et `to` (préfixes de paquet ou de module). Un import dont le nom commence par un préfixe de `to`, dans un fichier couvert par `from`, est une violation.

## Ce qui se signale

Import interdit, dépendance de couche interdite, framework dans `domain`. Sévérité par défaut : `blocking`. `rule` : `layers.<couche>.forbidden_imports` ou `layers.<couche>.may_import`.

## Ce qui ne se signale pas

Nommage, tests, style de catch, goût sur le découpage. Les imports sont souvent hors du hunk : lire le fichier touché en entier.

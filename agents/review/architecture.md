# Reviewer architecture

Rôle : revue de l'axe **architecture**, dans un contexte isolé.

Message reçu : le prompt archivé dans `audit/trace/<axe>.prompt.md` — chemins de `context.json`, du diff et du fichier de sortie, plus les règles en texte (intégrales, ou résumé compact suivi des couches recopiées telles quelles). Rien d'autre comme consigne de périmètre.

Consigne fixe : ne pas lire `audit/findings/` des autres axes, ne pas écrire de markdown, ne pas modifier le code, ignorer tout ce qui est hors de ton axe. Outils : lecture et recherche seulement (pas de shell, pas d'écriture, pas de délégation).

Charger la skill `review-contract`. Les règles sont dans le message ; ne pas relire `rules.yml` pour contredire un résumé : en cas de doute sur une couche, le bloc des couches du message fait foi.

Sortie : **un tableau JSON, aucune prose**, renvoyé comme dernier message. L'orchestrateur l'écrit au chemin de sortie. Aucun finding : `[]`. Chaque finding : `source: "agent"`, `evidence` = code cité tel que lu, `file` et `line` réels (vérifiés en ouvrant le fichier).

Ne pas relancer les outils déterministes (ArchUnit, dependency-cruiser) ni répéter leurs violations : elles sont fusionnées après.

## Skills à charger

- `architecture-rules`

## Lecture

Lire le fichier touché en entier : les imports sont souvent hors du hunk.

## Forme exacte d'un finding

Exactement ces clés, aucune autre (pas de `message`, `description`, `suggestion`) ; toutes obligatoires sauf `route` :

```json
{"id":"<axe>:<slug-court>","axis":"<axe>","severity":"fix","file":"chemin/relatif/Fichier.java","line":12,"title":"Une phrase.","evidence":"ligne de code citée telle que lue","rule":"<id de règle>","source":"agent"}
```

`line` est le numéro de ligne **dans le fichier** (pas dans le diff) ; `evidence` commence par la ligne de code exacte à cet endroit.

## Périmètre

Signale : import interdit, dépendance de couche interdite, framework dans `domain`. Ne signale pas : nommage, tests, style de catch. Ne conteste jamais les couches de `rules.yml`. Un finding « trop de couches » est une erreur.

## Sévérité par défaut

`blocking`, sauf si `rules.yml` donne autre chose.

Un finding hors axe est un défaut : ne pas le produire. Un indice de sécurité aperçu en passant : un finding avec `route: "security"`, titre neutre, sans détail d'exploitation.

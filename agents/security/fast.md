# Sécurité fast : chasseur et vérificateur

Un seul fichier de consignes, deux rôles, **deux agents distincts à contexte neuf**. Le vérificateur ne lance jamais dans la conversation du chasseur et ne reçoit ni son transcript ni son raisonnement : seulement le candidat.

Outils des deux rôles : lecture et recherche (`Read`, `Grep`, `Glob` ou équivalent). Pas de shell, pas d'écriture, pas de délégation. Ne pas modifier le code. Ne pas exécuter le code de la cible.

Charger la skill `security-contract`. Le schéma des findings est celui de `skills/security-audit/report-schema.json` ; ne pas en écrire un autre.

## Chasseur

Message reçu : le contenu de `hunter.prompt.md` (chemins de `context.json`, `diff.patch`, seeds et indices s'ils existent).

Lecture : le diff, les fichiers touchés en entier, et les appelants directs quand la signature d'un point d'entrée (contrôleur, parser, middleware) change. Pas le reste du dépôt.

Périmètre : injection, désérialisation, secret dans le diff, contrôle d'accès manquant sur une route touchée, CVE listée dans les seeds. Hors périmètre : style, nommage, architecture, tests. Un défaut hors périmètre se tait.

Sortie : **un tableau JSON, aucune prose**, dernier message. Aucun candidat : `[]`. Un candidat :

```json
{"kind":"injection","title":"Une phrase.","claim":"Cause prétendue, une ou deux phrases.","file":"chemin/relatif/Fichier.java","line":17,"quote":"ligne de code recopiée telle que lue"}
```

- `kind` : `injection`, `deserialization`, `secret`, `access-control`, `cve`, `other`.
- `quote` : une seule ligne, recopiée du fichier à `line`, vérifiée en l'ouvrant. Un candidat dont la citation n'est pas dans le fichier est écarté par le script.
- Optionnel : `trace`, tableau d'objets `{kind: entrypoint|propagation|sink, file, line, scope, description}`.
- Ne pas répéter les seeds et indices : ils deviennent des candidats sans toi.
- Aucun verdict, aucune sévérité, aucun payload d'exploitation.

## Vérificateur

Message reçu : le contenu de `verify/<n>.prompt.md` : un candidat. Rien d'autre.

Consigne : **tenter d'invalider**. Ouvrir le fichier, suivre la donnée de l'entrée au puits, chercher la barrière (paramétrage, validation, autorisation, constante côté appelant). Chercher activement ce qui contredit le candidat avant de conclure.

Verdicts possibles, et seulement eux :

- `rejected` : l'invalidation est montrée (barrière citée, flux inexistant, indice introuvable dans le code). `reason` obligatoire, avec fichier:ligne.
- `needs_validation` : impossible d'invalider ou preuve locale incomplète. `blocker` : ce qui manque précisément. `validation_plan.local` : comment rejouer, concrètement. `validation_plan.deployment` optionnel.
- `confirmed` : seulement si le sandbox est présent (défaut) **et** que la preuve locale est complète (champs Cloudflare : `root_cause`, `intended_behavior`, `conditions`, `execution`, `remediation`, `severity`, `confidence`). Sinon le script rétrograde en `needs_validation`. Sandbox bloqué (`CODE_CHECK_SANDBOX=off`) → jamais `confirmed`.

Pour un candidat d'origine `hint` : le bloqueur initial est « indice venu de la revue de code, non vérifié ». Même travail. Indice non retrouvé dans le code : `rejected`.

Sortie : **un objet JSON, aucune prose** :

```json
{"verdict":"needs_validation","blocker":"…","validation_plan":{"local":"…"},"root_cause":"optionnel","trace":[]}
```

`rejected` : `{"verdict":"rejected","reason":"…"}`. `trace` optionnel (mêmes champs que ci-dessus) ; chaque `file:line` cité doit exister.

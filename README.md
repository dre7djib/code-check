# code-check

Revue de code et revue de sécurité séparées, sur les postes de développement. Version 0.1.0 : **socle**. La commande `review` écrit un contexte et s'arrête. Aucun jugement de code.

## Hôtes

Un seul paquet pour quatre agents. `CODE_CHECK_HOST` : `mistral`, `copilot`, `claude`, `cursor`.

| Hôte | Manifeste / adaptateur | Commande | État 0.1.0 sur le poste de développement |
|---|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` | `/code-check:review` (forme attendue, à confirmer à l'install) | CLI 2.1.316 présent |
| Cursor | `.cursor-plugin/plugin.json`, `cursor/agents/` | à relever à l'install | présent |
| GitHub Copilot | `plugin.json`, `com.github.copilot/agents/` | à relever à l'install | extension dans Cursor seulement |
| Mistral Vibe | `plugin.json`, `ai.mistral.vibe/agents/` | `/code_check:review` (attendu, `toolNamespace: code_check`) | absent : adaptateur livré, jamais exécuté |

Les chaînes marquées « à relever » ou « attendu » ne sont pas observées. Les remplacer par la chaîne affichée par l'hôte le jour de l'install.

## Installation

Même tag `v0.1.0` pour chaque hôte (pas une branche).

- **Vibe** : placer le dépôt dans `~/.vibe/plugins/code-check` (ou le chemin d'organisation). `/plugins` doit lister `code-check`.
- **Copilot** : installer depuis le tag par la CLI, le marketplace d'organisation, ou l'extension. L'écran des plugins doit lister la skill `review`.
- **Claude Code** : `claude --plugin-dir <chemin du dépôt>`.
- **Cursor** : charger le plugin depuis le tag.

## Utilisation

Dans un repo contenant `.review/rules.yml` (modèle : `templates/rules.example.yml`), lancer la commande `review`. Elle crée `.review/runs/<run-id>/` avec `context.json`, `diff.patch`, `summary.txt` et affiche :

```
Revue de code   → <chemin>/review/REVIEW.md   non généré (socle)
Sécurité        → ignorée
Pistes croisées → 0
Hôte            → <hôte>
```

Sans `rules.yml` : message « rules.yml manquant », code 3, aucun dossier créé.

`rules.yml` est versionné, propriété de l'équipe du repo. `.review/runs/` est à ignorer par git.

## Tests

```
node --test scripts/*.test.cjs
```

## Ce que 0.1.0 ne fait pas

Pas de reviewer, pas d'orchestrateur, pas de script déterministe, pas de Ponytail, Caveman ni skill Cloudflare, pas de hook pre-push, pas de `REVIEW.md`. Voir `plans/` pour la suite.

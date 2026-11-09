# code-check

Revue de code et revue de sécurité séparées, sur les postes de développement. Version 0.4.0. La commande `review` cadre le run, lance les checks déterministes, fait relire cinq axes (architecture, nommage, tests, erreurs, simplicité) par des reviewers isolés et écrit `REVIEW.md`.

## Hôtes

Un seul paquet pour quatre agents. `CODE_CHECK_HOST` : `mistral`, `copilot`, `claude`, `cursor`.

| Hôte | Manifeste / adaptateur | Commande | État sur le poste de développement |
|---|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` | `/code-check:review` (forme attendue, à confirmer à l'install) | CLI 2.1.316 présent |
| Cursor | `.cursor-plugin/plugin.json`, `cursor/agents/` | à relever à l'install | présent |
| GitHub Copilot | `plugin.json`, `com.github.copilot/agents/` | à relever à l'install | extension dans Cursor seulement |
| Mistral Vibe | `plugin.json`, `ai.mistral.vibe/agents/` | `/code_check:review` (attendu, `toolNamespace: code_check`) | absent : adaptateur livré, jamais exécuté |

Les chaînes marquées « à relever » ou « attendu » ne sont pas observées. Les remplacer par la chaîne affichée par l'hôte le jour de l'install.

## Installation

Même tag (`v0.4.0`) pour chaque hôte (pas une branche).

- **Vibe** : placer le dépôt dans `~/.vibe/plugins/code-check` (ou le chemin d'organisation). `/plugins` doit lister `code-check`.
- **Copilot** : installer depuis le tag par la CLI, le marketplace d'organisation, ou l'extension. L'écran des plugins doit lister la skill `review`.
- **Claude Code** : `claude --plugin-dir <chemin du dépôt>`.
- **Cursor** : charger le plugin depuis le tag.

## Utilisation

Dans un repo contenant `.review/rules.yml` (modèle : `templates/rules.example.yml`), lancer la commande `review`. Elle crée `.review/runs/<run-id>/` :

```
context.json  diff.patch  summary.txt  cross-hints.json
deterministic/{raw/,review-findings.json,security-seeds.json}
review/{findings/<axe>.json,merged.json,REVIEW.md,REVIEW-DETAIL.md}
```

Codes de sortie : 0 rien de bloquant, 1 au moins un `blocking`, 2 un axe a échoué sans bloquant, 3 configuration invalide (pas de `rules.yml`, délégation indisponible sur l'hôte).

Les outils déterministes ne sont pas embarqués : ArchUnit (test `*Architecture*` du repo), dependency-cruiser (devDependency + config du repo), gitleaks (sur le PATH). Absent = skip noté dans `deterministic/raw/skipped.txt`.

`rules.yml` est versionné, propriété de l'équipe du repo. `.review/runs/` est à ignorer par git.

## Sécurité (mode fast)

Commande `security`. Un chasseur lit le diff, un vérificateur à contexte neuf tente d'invalider chaque candidat, `findings.json` est écrit au schéma Cloudflare vendoré puis validé (`scripts/validate-security.cjs <findings.json> --target <repo>`). Le mode fast n'exécute rien : le verdict normal est `needs_validation`, jamais `confirmed`.

Sortie, hors du dépôt cible versionné : `<workspace>/.review/<nom-du-repo>/runs/<run-id>/` en `0700` (`CODE_CHECK_WORKSPACE`, sinon la racine du dépôt ; `CODE_CHECK_SECURITY_DIR` remplace `<workspace>/.review`) :

```
findings.json  REPORT.md  FINDINGS-DETAIL.md  NEEDS-VALIDATION.md  summary.json
meta.json  candidates.json  verify/<n>.{prompt.md,verdict.json}
```

À faire dans le workspace (le plugin ne modifie pas le projet) : ajouter `/.review/` à son `.gitignore`. Le terminal n'affiche que les compteurs et le chemin du dossier, jamais un titre. `scripts/assert-review-has-no-security.sh <REVIEW.md> <findings.json>` vérifie qu'aucun finding sécurité n'a fui dans la revue.

Hors périmètre en 0.4.0 : les six phases, le coverage ledger, le mode deep (phase 6), le directeur et `/check` (phase 5).

## Tests

```
node --test scripts/*.test.cjs skills/security-audit/*.test.cjs
```

Fixture d'évaluation : voir `eval/README.md`.

## Ce que 0.4.0 ne fait pas

Pas de directeur ni de `/check`, pas de sécurité deep, pas de hook pre-push, pas de correctifs automatiques. Voir `plans/`.

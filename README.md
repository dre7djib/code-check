# code-check

Revue de code et revue de sécurité séparées, sur les postes de développement. Version 0.6.0. La commande `review` cadre le run, lance les checks déterministes, fait relire cinq axes (architecture, nommage, tests, erreurs, simplicité) par des reviewers isolés et écrit `REVIEW.md`.

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

Même tag (`v0.6.0`) pour chaque hôte (pas une branche).

- **Vibe** : placer le dépôt dans `~/.vibe/plugins/code-check` (ou le chemin d'organisation). `/plugins` doit lister `code-check`.
- **Copilot** : installer depuis le tag par la CLI, le marketplace d'organisation, ou l'extension. L'écran des plugins doit lister la skill `review`.
- **Claude Code** : `claude --plugin-dir <chemin du dépôt>`.
- **Cursor** : charger le plugin depuis le tag.

## Utilisation

Dans un repo contenant `.review/rules.yml` (modèle : `templates/rules.example.yml`), lancer la commande `review`. Elle crée `.review/runs/<run-id>/` :

```
context.json  diff.patch  summary.txt  cross-hints.json
deterministic/{raw/,review-findings.json,security-seeds.json}
audit/{findings/<axe>.json,merged.json,REVIEW.md,REVIEW-DETAIL.md}
```

Codes de sortie : 0 rien de bloquant, 1 au moins un `blocking`, 2 un axe a échoué sans bloquant, 3 configuration invalide (pas de `rules.yml`, délégation indisponible sur l'hôte).

Les outils déterministes ne sont pas embarqués : ArchUnit (test `*Architecture*` du repo), dependency-cruiser (devDependency + config du repo), un détecteur de secrets intégré (`scripts/scan-secrets.cjs`, sans dépendance, lignes ajoutées du diff seulement) tourne toujours : aucun outil de secrets à installer. Absent = skip noté dans `deterministic/raw/skipped.txt`.

`rules.yml` est versionné, propriété de l'équipe du repo. `.review/runs/` est à ignorer par git.

## Sécurité (mode fast)

Commande `security`. Un chasseur lit le diff, un vérificateur à contexte neuf tente d'invalider chaque candidat, `findings.json` est écrit au schéma Cloudflare vendoré puis validé (`scripts/validate-security.cjs <findings.json> --target <repo>`). Le mode fast n'exécute rien : le verdict normal est `needs_validation`, jamais `confirmed`.

Sortie dans le même run que la revue : `<repo>/.review/runs/<run-id>/security/` en `0700` :

```
findings.json  REPORT.md  FINDINGS-DETAIL.md  NEEDS-VALIDATION.md  PRIORITIES.md  summary.json
meta.json  candidates.json  verify/<n>.{prompt.md,verdict.json}
```

`PRIORITIES.md` classe les failles en **P1 / P2 / P3** (sévérité confirmée, ou priorité provisoire pour `needs_validation`). Chaque emplacement est un lien markdown relatif (`fichier#Llignes`) cliquable vers la ligne concernée.

Layout unifié d'un run `check` :

```
.review/runs/<run-id>/
  context.json  diff.patch  cross-hints.json  summary.txt
  deterministic/
  audit/       # revue de code (REVIEW.md, …)
  security/    # sécurité (findings.json, …)
```

Ajouter `.review/runs/` au `.gitignore` du repo (le plugin ne le fait pas). Le terminal n'affiche que les compteurs et le chemin du dossier, jamais un titre. `scripts/assert-review-has-no-security.sh <REVIEW.md> <findings.json>` vérifie qu'aucun finding sécurité n'a fui dans la revue.

## Commande `security-deep`

Audit complet du dépôt par la skill Cloudflare (six phases, agents isolés en parallèle). Aussi lancé par `check-deep` (run déjà cadré). Jamais par `check` (fast) ni par un hook. Exige `security.access: deep` dans `rules.yml`, Node ≥ 18 et un hôte qui sait déléguer en parallèle (sinon code 3, « deep indisponible sur cet hôte »). Sortie dans `<run>/security/` (`findings.json`, `architecture.md`, `coverage-ledger.json`, trois rapports, `PRIORITIES.md`, `summary.json`), en `0700`.

Le sandbox s'applique à **toute** la sécurité (`security`, `check`, `check-deep`, `security-deep`) via `scripts/sandbox-status.cjs` / `prereqs.json`. **Présent par défaut.** Pour le bloquer (jamais de `confirmed`) : `CODE_CHECK_SANDBOX=off` (aussi `absent`, `false`, `0`, `disabled`, `none`, `block`). Optionnel : préfixe d'isolement OS, par ex. macOS `CODE_CHECK_SANDBOX="sandbox-exec -p '(version 1)(allow default)(deny network*)'"` ; alors `present` seulement s'il isole vraiment (réseau refusé).

## Commande `check` (directeur)

`check` cadre une fois (`scoping`, un seul `context.json` et `diff.patch` pour les deux pipelines), lance la revue et la sécurité fast, route les pistes croisées (seconde passe `add-hints`, sans refaire la chasse), et n'imprime que des compteurs :

```
Revue de code   → <REVIEW.md>     2 bloquants · 5 à corriger · 8 suggestions
Sécurité        → <dossier>       1 confirmed · 2 needs_validation
Pistes croisées → 1 transmise à la sécurité
```

Codes : 0 rien de bloquant ; 1 bloquant de revue ou `confirmed` sécurité au seuil `thresholds.security_confirmed_min_severity` ; 2 un pipeline manque ou échoue, sans bloquant ; 3 configuration, accès refusé, `deep` demandé (« utiliser check-deep ou security-deep »). Le directeur ne lit de la sécurité que `summary.json` (`scripts/assert-director-blind.sh` le contrôle). Sans deux contextes simultanés, les pipelines s'enchaînent (`pipelines séquentiels` dans `summary.txt`). Le directeur n'attend pas au-delà de `max_minutes` + 1 minute (`scripts/await-pipeline.cjs`) et marque l'absent `failed`.

## Commande `check-deep` (directeur deep)

`check-deep` cadre une fois en mode deep (`security.access: deep` exigé), lance la revue et la sécurité deep sur le même run, et n'imprime que des compteurs (même format que `check`). Pas de seconde passe `add-hints` : le deep audite le dépôt entier, les indices de revue ne passent pas par le pipeline fast. Prérequis deep avant toute création de run. Skill `check-deep`, procédure `agents/director-deep.md`, adaptateurs `director-deep` sur les 4 hôtes.

`security.access` de `rules.yml` (`none`, `fast`, `deep`; absent = `fast`) est la politique du repo, pas un verrou par personne : `review` l'ignore, `security` et `check` exigent au moins `fast`, `security-deep` et `check-deep` exigent `deep` (`scripts/check-access.cjs`). Pour retirer une commande à un groupe, désactiver la skill dans la config d'administration de l'hôte. Les garanties réelles : `<run>/security/` en `0700` et `.review/runs/` gitignoré, et le fait que `review` ne lance pas la sécurité.

## Tests

```
node --test scripts/*.test.cjs skills/security-audit/*.test.cjs
```

Fixture d'évaluation : voir `eval/README.md`.

## Ce que 0.6.0 ne fait pas

 pas de hook pre-push, pas de correctifs automatiques. Voir `plans/`.

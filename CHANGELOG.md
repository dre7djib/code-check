# Changelog

## 0.3.0

- Axe `simplicity` : reviewer `agents/review/simplicity.md` (Ponytail restreint à la catégorie Lean, couches imposées en ADR, jamais `blocking`), adaptateurs Vibe, Copilot, Cursor, Claude.
- Composants figés copiés : `skills/ponytail` (MIT, `09c434ab`) et `skills/caveman` (MIT, `ef6050c5`), sans CLI, hooks ni télémétrie. Voir `vendor-lock.md`. La licence de Caveman est MIT, pas Apache-2.0 comme le plan le disait.
- Règles de l'orchestrateur : un finding `simplicity` `blocking` est écarté (hors axe) ; un finding `simplicity` qui parle d'un test manquant est écarté quand l'axe `tests` est actif ; les `hints` de simplicité vont dans `cross-hints.json`, jamais dans `REVIEW.md`.
- `scripts/build-prompts.cjs` : prompt de chaque reviewer archivé dans `review/trace/` ; règles intégrales (`full`) ou résumé Caveman plus couches recopiées telles quelles (`compact`).
- `scripts/measure-tokens.sh` : mesure A/B en caractères (tokens = caractères / 4, estimation), sans réseau. Résultat dans `eval/token-report.md`.
- `scope.cjs` ne filtre plus `simplicity` dans `context.axes`.
- Fixtures `port-not-bloat`, `needless-factory`, `missing-test-only`.
- Écart : un reviewer simplicité peut répondre `{findings, hints}` au lieu d'un tableau (`save-findings.cjs`), pour porter les pistes de sécurité sans champ libre dans le schéma revue.

## 0.2.0

- Commande `review` complète : checks déterministes (`scripts/run-deterministic.sh` : ArchUnit, dependency-cruiser, versions non épinglées, CVE et secrets vers `security-seeds.json` seulement), quatre reviewers isolés (architecture, nommage, tests, erreurs), fusion et rapport (`scripts/build-report.cjs`) : `REVIEW.md`, `REVIEW-DETAIL.md`, `merged.json`, `cross-hints.json`.
- Skills `architecture-rules`, `naming-conventions`, `review-contract`, `review-report`.
- Procédures `agents/review/*.md`, adaptateurs Vibe, Copilot, Cursor et Claude (`claude/agents/`, déclarés dans `.claude-plugin/plugin.json`).
- Le reviewer renvoie son JSON dans son message ; l'orchestrateur l'écrit via `scripts/save-findings.cjs` (les reviewers n'ont pas d'outil d'écriture).
- Fixture `eval/fixtures/java-planted`.
- Limites connues : Claude Code charge aussi `agents/review/*.md` comme agents (sans frontmatter) ; `dependency:tree` et `npm ls` remplacés par une lecture directe de `pom.xml`, `build.gradle` et `package.json` ; pas de contrôle de licence (aucune allowlist dans `rules.yml`).

## 0.1.0

- Socle : manifeste Agent Plugins 1.0, adaptateurs Vibe, Copilot, Claude Code, Cursor.
- Skills `rules-loader`, `scoping`, `review` (commande vide : écrit `context.json`, `diff.patch`, `summary.txt`, aucun reviewer).
- Schémas `review-findings`, `review-findings-file`, `security-findings` (résumé) et validateur zéro dépendance.
- Hôtes rejoués : voir README. Mistral Vibe et Copilot CLI/VS Code/app : adaptateur livré, premier run réel non fait (hôte absent du poste).

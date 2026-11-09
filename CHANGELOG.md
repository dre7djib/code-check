# Changelog

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

# Changelog

## 0.4.0

- Commande `security`, mode fast : `agents/security/orchestrator.md`, chasseur et vérificateur dans `agents/security/fast.md` (deux agents à contexte neuf, le vérificateur ne reçoit que le candidat), skills `security` et `security-contract`, adaptateurs `security-hunter`, `security-verifier`, `security-orchestrator` pour Vibe, Copilot, Cursor et Claude.
- `scripts/security-fast.cjs` : `prepare` (seeds et pistes croisées deviennent des candidats), `save-candidates` (citation vérifiée dans le fichier), `verifier-prompts`, `save-verdict`, `finalize` (`findings.json` trié par fingerprint, validation, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `summary.json`). Un `confirmed` du vérificateur est rétrogradé en `needs_validation` : le fast n'exécute rien. Une réécriture permise après refus du validateur (code 4), puis `status: failed` et code 2.
- `scripts/prepare-security-dir.sh` : `<workspace>/.review/<nom-du-repo>/runs/<run-id>` en `0700`, `CODE_CHECK_SECURITY_DIR`, suffixe SHA-256 en cas de nom en double, `security-dir.path` dans le run de revue.
- `scripts/validate-security.cjs` : validateur Cloudflare vendoré puis contrôles du dépôt cible (`--target`). `scripts/assert-review-has-no-security.sh` : échoue si un titre, une citation, un `fichier:ligne` ou les mots SQL, CVE, injection, secret figurent dans `REVIEW.md`.
- Copie partielle de `cloudflare/security-audit-skill` (`c1c8a8c1`, MIT), voir `vendor-lock.md`. Écart : le validateur vendor n'a pas d'option `--target`.
- Fixture `eval/fixtures/security-fast` (concaténation SQL dans un adaptateur).
- Limite : pas de run réel du chasseur et du vérificateur sur les hôtes Vibe, Copilot, Cursor (voir README).

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

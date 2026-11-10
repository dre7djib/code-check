# Changelog

## Unreleased

- Correctif Windows : les validateurs Cloudflare (`validate-findings.cjs`, `validate-coverage-ledger.cjs`) n'exigent plus `O_NOFOLLOW`/`O_NONBLOCK` (absents sous Node Windows). Sur `win32`, ouverture avec contrôle d'identité `(dev, ino)` avant/après `open` (port de [cloudflare/security-audit-skill#145](https://github.com/cloudflare/security-audit-skill/pull/145)). Sans ce correctif, la validation échoue systématiquement avec le code 2 (« OS no-follow and nonblocking input protection is unavailable »).

## 0.6.0

- Commande `security-deep` : `agents/security/deep.md` (enveloppe : accès, prérequis, cadrage, dossier, confirmation du parallélisme, sandbox, échéance, clôture) puis skill Cloudflare complète, skill `security-deep`, adaptateurs `security-deep`, `security-deep-research`, `security-deep-general` pour les 4 hôtes.
- Copie complète de `cloudflare/security-audit-skill` au même SHA (`c1c8a8c1`), voir `vendor-lock.md`. Aucune URL dans la copie.
- `scripts/check-deep-prereqs.sh` : Node ≥ 18 et validateurs (sinon code 3, rien écrit), `prereqs.json` sur stdout. Sandbox `present` seulement si `CODE_CHECK_SANDBOX` (préfixe de commande) exécute `true` et refuse une connexion sortante ; sinon mode dégradé, aucun `confirmed`.
- `scripts/finalize-deep.cjs` : valide ledger et findings, refuse `confirmed` sans sandbox, `summary.json` au schéma du fast, `exit-code`, `failure.txt`. Run partiel : `status: failed`, fichiers gardés.
- `scope.cjs --command security-deep` : mode `deep`, budget deep. `check` et le hook n'y touchent jamais.
- Correctif : le seuil `security_confirmed_min_severity` lisait `severity` comme une chaîne ; dans le schéma Cloudflare c'est un objet (`severity.overall_severity`). Un `confirmed` n'atteignait donc jamais le seuil (fast et deep).
- Deep branché sur le commit amont `c1c8a8c1`. Limites : aucun run pilote réel (code et autorisation d'envoi au modèle requis) ; le test de sandbox ne prouve ni l'environnement vide, ni la cible en lecture seule, ni les limites de ressources ; la capacité de délégation parallèle n'est confirmée qu'à l'exécution.

## 0.5.1

- Détecteur de secrets intégré `scripts/scan-secrets.cjs` (clés AWS, clés privées, jetons GitHub/Slack/Stripe/Google, JWT, identifiants dans une URL, affectations littérales à entropie suffisante, placeholders ignorés). Il lit les lignes ajoutées du diff, donne la ligne du fichier, et ne recopie jamais la valeur. Il alimente `security-seeds.json` ; gitleaks n'est plus appelé (sa lecture d'un `gitleaks.json` déposé à la main reste). Avant : sans gitleaks, aucun secret n'était détecté, et gitleaks lancé sur le patch ne donnait pas de chemin de fichier exploitable.
- Limite : détection par motifs, sans l'historique git ; le chasseur sécurité reste le second filet.

## 0.5.0

- Commande `check` : `agents/director.md`, skill `check`, adaptateurs directeur des 4 hôtes (outils élargis à la délégation). Cadrage unique, pipelines parallèles ou séquentiels, pistes croisées par une seconde passe (`security-fast.cjs add-hints`, `finalize --budget-exhausted`).
- `scripts/build-summary.cjs` : résumé de compteurs, code de sortie 0/1/2 selon le tableau de la phase. `scripts/await-pipeline.cjs` : attente bornée, sécurité marquée `failed` au délai. `scripts/check-access.cjs` : `security.access`. `scripts/assert-director-blind.sh`.
- `load-rules.cjs` lit `security.access` (absent = `fast`) et `budgets` ; `context.json` porte `security_access` et `budget` du mode.
- `finalize` écrit `exit-code` (un nombre) à côté de `summary.json` ; c'est le seul fichier hors `summary.json` que `build-summary.cjs` lit dans le dossier sécurité.
- Fixture `eval/fixtures/check-both` (import interdit + SQL planté).
- Limites : `usage.json` vaut `tokens: unknown` tant que l'hôte n'expose pas d'usage ; aucun run réel de `check` sur un hôte (tests de bout en bout avec réponses d'agents écrites à la main) ; le parallélisme réel n'est pas mesuré.

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

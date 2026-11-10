# Conventions partagées

Référence pour toutes les phases. Ne pas recopier ces contrats dans les prompts : les skills les chargent.

## Hôtes

Le moteur est indépendant de l'outil. Un seul paquet, les mêmes skills, les mêmes règles, les mêmes rapports, sur chaque agent. Une phase se rejoue sur chaque hôte installé sur le poste. Un hôte absent reste dans le paquet : il n'est pas retiré, et il n'est pas marqué réussi.

| Hôte | `CODE_CHECK_HOST` | Ce qu'il charge |
|---|---|---|
| Mistral Vibe (CLI et extension VS Code) | `mistral` | `plugin.json`, `skills/`, `ai.mistral.vibe/` |
| GitHub Copilot (CLI, VS Code, app, extension dans Cursor) | `copilot` | `plugin.json`, `skills/`, `com.github.copilot/` |
| Claude Code | `claude` | `.claude-plugin/plugin.json` et les mêmes `skills/` |
| Cursor | `cursor` | `.cursor-plugin/plugin.json`, `skills/`, `cursor/agents/` |

Ce qui est partagé, et qui ne se réécrit pas par hôte : `rules.yml`, les schémas, les scripts, les skills, les procédures dans `agents/`, les rapports. Ce qui est propre à l'hôte : le fichier qui déclare un sous-agent et le nom des outils (`read_file` chez Mistral, les outils Copilot, `Read` chez Claude et Cursor).

Les skills sont des enfants directs de `skills/<nom>/SKILL.md`. Agent Plugins 1.0 ne cherche pas de skill dans un sous-dossier plus profond. `skills/review/architecture/SKILL.md` ne serait chargé par personne.

Commandes métier, chacune une skill invocable par l'utilisateur : `review`, `check`, `security`, `security-deep`, `review-fix`. Le préfixe affiché dépend de l'hôte. On le relève sur la machine (`/plugins` côté Vibe, l'écran plugins côté Copilot) et on le copie dans le README. On ne l'invente pas. Repères actuels, à revérifier le jour de l'install :

| Hôte | Forme attendue |
|---|---|
| Mistral Vibe | `/code_check:review` si `toolNamespace` vaut `code_check` (le tiret n'est pas admis dans ce préfixe) |
| Copilot | préfixe du plugin, en pratique `/code-check:review` |
| Claude Code | `/code-check:review` |
| Cursor | la chaîne affichée par Cursor le jour de l'install, copiée dans le README |

`disable-model-invocation: true` sur les cinq commandes : elles ne partent que sur demande explicite. Les skills internes (cadrage, règles, rapport, reviewers) ont `user-invocable: false`.

Langue des prompts maison et des rapports : français. Les skills vendored restent dans leur langue. Le reviewer qui les enveloppe traduit vers le schéma interne.

## Plugin

Racine : ce dépôt.

```
plugin.json                          # Agent Plugins 1.0, lu par Vibe et Copilot
skills/<nom>/SKILL.md                # skills plates, partagées
agents/                              # procédures, lues par les skills ; pas un format d'hôte
schemas/  scripts/  templates/
ai.mistral.vibe/agents/*.toml        # sous-agents Vibe, un fichier court par rôle
com.github.copilot/agents/*.agent.md # agents Copilot, un fichier court par rôle
.claude-plugin/plugin.json           # même nom, même version
.cursor-plugin/plugin.json           # champ agents = cursor/agents
cursor/agents/*.md                   # agents Cursor, un fichier court par rôle
```

`plugin.json` n'a que les champs du schéma 1.0.0 : `$schema`, `name`, `version`, `description`, `author`, `license`, `keywords`, `extensions`. Pas de `commands`, pas de `userConfig`, pas de chemin d'agent. Les données Vibe sont sous `extensions.ai.mistral.vibe`. Copilot découvre `com.github.copilot/` tout seul. Un champ hors schéma fait rejeter le plugin par Vibe. Le manifeste Cursor est `.cursor-plugin/plugin.json`, fichier à part : son champ `agents` vaut `cursor/agents`, pour qu'il ne charge pas les procédures de `agents/`.

Chaque adaptateur tient en un écran : il nomme le rôle, restreint les outils, et dit de lire le fichier `agents/...md` correspondant sans l'improviser. La procédure n'est pas recopiée dans le toml, le `.agent.md`, ni le fichier Cursor. Si Cursor ne propose pas une skill comme commande, l'adaptateur ajoute `commands/<nom>.md` dont le corps est une ligne : lire `skills/<nom>/SKILL.md`.

Le hook pre-push n'appelle pas un binaire d'hôte en dur. Il appelle `scripts/run-review.sh`, qui lit `CODE_CHECK_HOST` (`mistral`, `copilot`, `claude`, `cursor`), posé par l'adaptateur de la session. Si le binaire de cet hôte manque, le script affiche le message et sort 0. Il ne lance pas un autre agent.

## Emplacements

Revue et sécurité, dans le même run du repo cible, non commitées :

```
.review/rules.yml                         # versionné, propriété de l'équipe
.review/runs/<run-id>/
  context.json
  diff.patch
  deterministic/raw/                      # stdout des outils, non interprété
  deterministic/review-findings.json
  deterministic/security-seeds.json       # CVE, secrets : jamais vers REVIEW.md
  cross-hints.json                        # pistes transmises à la sécurité
  summary.txt                             # compteurs seuls
  audit/
    findings/<axis>.json
    merged.json
    REVIEW.md
    REVIEW-DETAIL.md
  security/                               # 0700
    findings.json
    REPORT.md
    FINDINGS-DETAIL.md
    NEEDS-VALIDATION.md
    PRIORITIES.md                         # P1/P2/P3 + liens fichier#Llignes
    coverage-ledger.json                  # deep seulement
```

`<run-id>` = `YYYYMMDDTHHMMSSZ` + `-` + 12 caractères du SHA HEAD.

`.review/runs/` est ignoré par git. Le plugin ne modifie pas le projet sans demande. Les rapports ne sont pas commités. Le directeur reçoit les compteurs, pas le détail.

## Modes

| Mode | Déclencheur | Revue | Sécurité | Budget par défaut |
|---|---|---|---|---|
| `fast` | hook, ou diff ≤ 200 lignes et aucun fichier sous `.review/` | architecture, nommage, erreurs | non, sauf `/security` | 5 min, 80 000 tokens |
| `standard` | `/review`, `/check` au-delà du seuil fast | axes fast + tests + simplicité (dès la phase 3) | fast si la commande est `/check` ou `/security` | 15 min, 250 000 tokens |
| `deep` | `/security-deep` seulement, jamais automatique | identique à standard si la commande est `/check` avec argument deep | skill Cloudflare, repo complet | 90 min, 1 500 000 tokens |

Le dépassement de budget arrête le pipeline concerné, écrit ce qu'il a, et remonte un échec partiel. Il ne bascule pas en deep.

## Codes de sortie

| Code | Sens |
|---|---|
| 0 | Les pipelines demandés ont fini, aucun bloquant. |
| 1 | Revue avec au moins un `blocking`, ou sécurité avec un `confirmed` dont la sévérité atteint le seuil de `rules.yml`. |
| 2 | Un pipeline a échoué ou a été coupé, et aucun bloquant n'a été produit. Le rapport de l'autre pipeline est quand même rendu. |
| 3 | Configuration invalide : pas de `rules.yml`, schéma invalide, plugin incomplet. |

Si un pipeline échoue et que l'autre a un bloquant, le code est `1`. `summary.txt` nomme toujours le pipeline manquant.

## `rules.yml` version 1

Fichier par repo. Le plugin refuse une `version` autre que `1`.

```yaml
version: 1
architecture:
  style: hexagonal
  layers:
    - name: domain
      paths: ["**/domain/**"]
      may_import: []
    - name: application
      paths: ["**/application/**"]
      may_import: [domain]
    - name: adapters
      paths: ["**/adapters/**", "**/infrastructure/**"]
      may_import: [domain, application]
  forbidden_imports:
    - from: "**/domain/**"
      to: ["org.springframework", "jakarta.persistence", "javax.persistence"]
naming:
  - id: transactional-service
    include: ["**/*Service.java", "**/*Service.ts"]
    when_annotation: ["Transactional", "org.springframework.transaction.annotation.Transactional"]
    suffix: Transactional
    severity: fix          # blocking | fix | suggestion
tests:
  risky_paths: ["**/domain/**", "**/application/**"]
  severity_if_missing: fix
errors:
  forbid_empty_catch: true
  severity: fix
axes:
  review: [architecture, naming, tests, errors, simplicity]
thresholds:
  security_confirmed_min_severity: high   # low | medium | high | critical
budgets:
  fast:     { max_minutes: 5,  max_tokens: 80000 }
  standard: { max_minutes: 15, max_tokens: 250000 }
  deep:     { max_minutes: 90, max_tokens: 1500000 }
display:
  review_max_findings: 10
security:
  access: fast           # none | fast | deep ; politique du repo, pas un verrou par personne
pre_push:
  enabled: false
  blocking: false
```

Les couches listées dans `architecture.layers` sont imposées. Aucun reviewer ne peut les qualifier de sur-ingénierie.

## Schéma d'un finding de revue

Fichier : `schemas/review-findings.schema.json`. Un fichier d'axe est un tableau de ces objets. `additionalProperties: false`.

| Champ | Règle |
|---|---|
| `id` | Stable, `[a-z0-9-]+:[a-z0-9-]+`, unique dans le run. |
| `axis` | `architecture`, `naming`, `tests`, `errors`, `simplicity`, `deterministic`. |
| `severity` | `blocking`, `fix`, `suggestion`. |
| `file` | Chemin relatif au repo, sans `..` ni absolu. |
| `line` | Entier ≥ 1. |
| `title` | Une phrase, sans procédure d'exploitation. |
| `evidence` | Citation du code ou sortie d'outil. |
| `rule` | Id de règle (`layers.domain.forbidden_imports`, id de nommage, ou nom de test ArchUnit). |
| `source` | `archunit`, `dependency-cruiser`, `linter`, `dependency-audit`, `agent`. |
| `route` | Optionnel. Seule valeur admise : `security`. Le finding quitte alors la revue. |
| `autofix` | Optionnel. Seule valeur admise : `safe`. Réservé au nommage et aux imports, phase 8. |
| `also_flagged_by` | Optionnel, rempli par l'orchestrateur, pas par le reviewer. |

## Dédoublonnage

1. Écarter tout objet qui ne valide pas le schéma. Le compter dans `summary.txt` comme `écarts schéma`.
2. Tout finding avec `route: security` va dans `cross-hints.json`. Zéro caractère de ce finding dans `REVIEW.md`.
3. Clé = `file:line`. À clé égale : garder la sévérité la plus haute (`blocking` > `fix` > `suggestion`), conserver son `evidence`, ajouter les autres axes dans `also_flagged_by`.
4. Trier par sévérité, puis chemin, puis ligne.
5. `REVIEW.md` : au plus `display.review_max_findings` (défaut 10). `REVIEW-DETAIL.md` : la liste complète.
6. Les seeds déterministes de sécurité (CVE, secrets) vont dans `security-seeds.json`, même traitement que `route: security`.

## Ce qui relève de quel rapport

| Signal | Rapport |
|---|---|
| Import interdit, couche, nommage, test manquant, catch vide, version non épinglée, licence | Revue |
| CVE, secret, injection, auth, désérialisation | Sécurité |
| Indice de sécurité vu par un reviewer de code | `cross-hints.json`, puis sécurité en `needs_validation` |

Ponytail ne publie pas de finding sécurité. S'il en produit un, l'orchestrateur de revue le déplace en piste croisée.

## Agents

La procédure vit dans `agents/<rôle>.md`, sans frontmatter d'hôte. L'adaptateur ne fait que la pointer et limiter les outils.

| Rôle | Peut | N'a pas | Écrit |
|---|---|---|---|
| Reviewer d'axe | Lire et chercher dans le repo | Shell, écriture de code, délégation | Uniquement son JSON de findings, au chemin reçu |
| Orchestrateur revue | Lire, chercher, shell des scripts du plugin, déléguer un reviewer | Écrire dans le repo hors du dossier de run | Le dossier `review/` du run |
| Orchestrateur sécurité | Lire, chercher, shell des validateurs, déléguer | Écrire dans le code applicatif ou dans `audit/` | Uniquement `<run>/security/` |
| Directeur | Lire, shell de cadrage, déléguer les deux orchestrateurs | Lire le détail sécurité | `context.json`, `summary.txt` |

Correspondance des outils, tenue dans l'adaptateur et nulle part ailleurs :

| Capacité | Mistral Vibe | Copilot | Claude Code | Cursor |
|---|---|---|---|---|
| Lire | `read_file` | outil de lecture du schéma agent du jour | `Read` | `Read` |
| Chercher | `grep` | outil de recherche du schéma agent du jour | `Grep`, `Glob` | `Grep`, `Glob` |
| Shell | `bash`, permission `ask` | shell, si l'agent l'autorise | `Bash` | `Shell` |
| Déléguer | sous-agent `ai.mistral.vibe/agents/*.toml` | agent `com.github.copilot/agents/*.agent.md` | agent Claude | `Task`, vers `cursor/agents/` |

Un hôte qui ne sait pas ouvrir un contexte neuf pour un reviewer n'est pas contourné en laissant l'orchestrateur faire tous les axes dans la même conversation. La commande s'arrête, code 3, avec « délégation indisponible sur cet hôte ». Le mode fast de la sécurité peut enchaîner chasseur puis vérificateur en deux invocations séparées : l'isolation compte, le parallélisme non. Le mode deep, lui, exige des sous-agents parallèles. Sans eux, `security-deep` sort 3 sur cet hôte et ne simule pas la skill Cloudflare dans un seul contexte.

Le directeur reçoit de la sécurité le seul objet « résumé » : comptes `confirmed`, `needs_validation`, `rejected`, statut `ok | failed | skipped`. Pas de titre, pas de fichier, pas de citation.

Le shell des orchestrateurs sert aux scripts du plugin (`run-deterministic.sh`, validateurs). Les reviewers d'axe ne l'ont pas : ils ne relancent pas les outils déterministes.

`security.access` dans `rules.yml` dit ce que le repo autorise (`none`, `fast`, `deep`). Ce n'est pas un contrôle par développeur. Pour retirer une commande à une population, on la désactive dans la config d'administration de l'hôte (admin Vibe, politique Copilot, réglages Claude, réglages Cursor). La barrière qui compte reste le dossier sécurité en `0700`.

## Contexte passé à un reviewer

Le message contient quatre chemins et rien d'autre comme consigne de périmètre :

1. `context.json`
2. `rules.yml`
3. le diff
4. le chemin de sortie JSON

Consigne fixe, répétée dans chaque agent : ne pas lire `audit/findings/` des autres axes, ne pas écrire de markdown, ne pas modifier le code, ignorer tout ce qui est hors de son axe. L'architecture lit le fichier touché en entier (les imports sont souvent hors du hunk). Les autres axes s'en tiennent au diff plus les tests du fichier touché.

## Composants figés

`vendor-lock.md` enregistre pour chaque copie : origine, commit, licence, date de copie, propriétaire de la relecture. Pas de sous-module qui suit une branche. Pas de `npx skills add` au runtime. La télémétrie Caveman ne s'installe pas : on copie la skill, pas le CLI.

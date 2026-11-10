# Plugin `code-check` : plan de réalisation

Industrialiser la revue de code et la revue de sécurité dans le périmètre de l'entreprise, via un plugin partagé qui s'exécute sur les postes des développeurs.

- **Statut** : plan v1, à valider
- **Durée estimée** : 8 à 10 semaines pour une première version déployée (une personne, à ajuster selon la disponibilité)

---

## 1. Objectifs

1. Vérifier le respect de l'architecture (exemple : hexagonale, `core/domain` indépendant des frameworks).
2. Imposer des standards de nommage (exemple : tout service transactionnel suffixé `Transactional`).
3. Réduire la sur-ingénierie et détecter les tests manquants (Ponytail).
4. Réaliser une revue de sécurité avec la skill d'audit de sécurité de Cloudflare.
5. Garder la **revue de code** et la **sécurité** comme deux rapports distincts, pilotés par un orchestrateur unique.

### Hors périmètre de la v1

- Correction automatique au-delà des changements sûrs (nommage, imports).
- Intégration CI centralisée et tableau de bord (à étudier après la v1).
- Axes de revue secondaires (voir section 9).

---

## 2. Principes de conception

| Principe | Conséquence |
|---|---|
| Déterministe d'abord | ArchUnit, dependency-cruiser, linters et audit de dépendances s'exécutent avant les agents. Le LLM interprète leurs résultats. |
| Règles dans le repo, mécanique dans le plugin | Chaque équipe versionne `.review/rules.yml` et change ses règles sans toucher au plugin. |
| Deux pipelines indépendants | Revue de code et sécurité ont des formats, des verdicts, des publics et des emplacements différents. |
| Un directeur, pas de rapport commun | Le directeur cadre, lance et route. Il ne fusionne pas les rapports. |
| Contexte isolé par reviewer | Chaque sous-agent a un périmètre exclusif et un contexte réduit, ce qui évite les doublons et réduit les coûts. |
| Composants externes figés | Ponytail, Caveman et la skill Cloudflare sont copiés dans le plugin sur un commit relu, jamais installés dynamiquement. |

---

## 3. Composants externes

### Ponytail (`DietrichGebert/ponytail`, licence MIT)

Skill qui fait raisonner l'agent comme un senior pragmatique. Elle fournit `/ponytail-review` (bugs, sécurité, charge, tests manquants, lenteurs, code à supprimer, lecture du code touché hors du diff) et `/ponytail-audit`.

- **Usage dans le plugin** : reviewer « simplicité », dans le pipeline de revue de code uniquement.
- **Point de vigilance** : tendance à signaler les ports et adapters hexagonaux comme de la sur-ingénierie. Le prompt du reviewer doit lui transmettre les règles d'architecture et lui interdire de contester les couches imposées par l'ADR.

### Caveman (`JuliusBrussee/caveman`, licence Apache-2.0)

Skill de réduction de tokens (réponses courtes, compression de fichiers de règles).

- **Usage dans le plugin** : échanges internes entre sous-agents et compression des fichiers de règles chargés à chaque run. **Jamais** dans les rapports finaux ni dans le pipeline sécurité.
- **Point de vigilance** : le CLI Caveman envoie des statistiques d'usage par défaut, et son mode « Auto » envoie la demande et son contexte à un service cloud. N'utiliser que la skill copiée dans le plugin, pas le CLI, quel que soit l'hôte. Désactiver la télémétrie (`caveman telemetry off` ou `DO_NOT_TRACK=1`) si le CLI est présent sur un poste.

### Skill `security-audit` (`cloudflare/security-audit-skill`, licence MIT)

Audit en six phases avec agents isolés : reconnaissance, chasse guidée par une grille de couverture, validation des candidats par un vérificateur indépendant, sortie structurée (`findings.json`), vérification indépendante des sources, rapports. Verdicts : `confirmed`, `needs_validation`, `rejected`.

- **Usage dans le plugin** : pipeline sécurité, en mode deep (repo complet). Une version allégée sur le diff alimente le mode fast.
- **Prérequis** : Node.js (validateurs `validate-findings.cjs` et `validate-coverage-ledger.cjs`), modèle capable de lancer des sous-agents en parallèle, sandbox imposé par l'OS pour l'exécution de code de la cible (sans lui, la skill laisse la piste en `needs_validation` au lieu d'exécuter).

---

## 4. Architecture du plugin

Mistral Vibe, GitHub Copilot, Claude Code et Cursor sont les hôtes. Le paquet suit Agent Plugins 1.0 pour Vibe et Copilot : un `plugin.json` à la racine, des skills plates dans `skills/`, et les fichiers propres à chaque outil dans un dossier qu'il est seul à lire. Claude Code charge `.claude-plugin/`. Cursor charge `.cursor-plugin/`. Les procédures d'agents ne sont pas dupliquées : chaque adaptateur pointe vers `agents/`.

```
code-check/
├─ plugin.json                 # Agent Plugins 1.0, lu par Vibe et Copilot
├─ .claude-plugin/
│  └─ plugin.json              # même nom, même version
├─ .cursor-plugin/
│  └─ plugin.json              # agents pointés vers cursor/agents
├─ ai.mistral.vibe/
│  └─ agents/                  # sous-agents Vibe, fichiers courts
├─ com.github.copilot/
│  └─ agents/                  # agents Copilot, fichiers courts
├─ cursor/
│  └─ agents/                  # agents Cursor, fichiers courts
├─ agents/                     # procédures partagées, sans format d'hôte
│  ├─ director.md              chef d'orchestre des deux pipelines
│  ├─ review/
│  │  ├─ orchestrator.md
│  │  ├─ architecture.md
│  │  ├─ naming.md
│  │  ├─ simplicity.md         Ponytail
│  │  ├─ tests.md
│  │  ├─ errors.md
│  │  ├─ perf.md
│  │  ├─ data-migrations.md
│  │  ├─ api-contract.md
│  │  ├─ observability.md
│  │  └─ docs-adr.md
│  └─ security/
│     ├─ orchestrator.md
│     ├─ fast.md               sur le diff
│     └─ deep.md               skill Cloudflare
├─ skills/                     # un niveau : skills/<nom>/SKILL.md
│  ├─ review/                  # commande
│  ├─ check/                   # commande
│  ├─ security/                # commande, mode fast
│  ├─ security-deep/           # commande
│  ├─ review-fix/              # commande, correctifs sûrs
│  ├─ scoping/                 # diff, stack, périmètre
│  ├─ rules-loader/            # lit .review/rules.yml
│  ├─ architecture-rules/
│  ├─ naming-conventions/
│  ├─ review-contract/
│  ├─ review-report/           # génère REVIEW.md
│  ├─ security-audit/          # copie figée de la skill Cloudflare
│  ├─ security-contract/
│  ├─ ponytail/                # copie figée
│  └─ caveman/                 # copie figée, usage interne
├─ schemas/
│  ├─ review-findings.schema.json
│  └─ security-findings.schema.json
├─ scripts/
│  ├─ run-deterministic.sh
│  ├─ run-review.sh            # pre-push : hôte de la session, CODE_CHECK_HOST
│  ├─ validate-findings.cjs
│  └─ validate-coverage-ledger.cjs
├─ templates/
│  └─ rules.example.yml
├─ vendor-lock.md              commits figés et licences
├─ CHANGELOG.md
└─ README.md
```

Les commandes utilisateur sont des skills (`review`, `check`, `security`, `security-deep`, `review-fix`), pas un dossier `commands/`. Le préfixe est celui qu'affiche l'hôte (Vibe, Copilot, Claude, Cursor). Agent Plugins 1.0 ne charge pas une skill enfouie : `skills/<nom>/SKILL.md` est au premier niveau.

### Dans chaque repo

```
.review/
└─ rules.yml     couches, imports interdits, nommage, axes actifs, seuils
```

### Distribution

Le même tag Git est installé sur chaque hôte. Vibe le charge depuis son répertoire de plugins (poste ou config d'administration). Copilot le charge depuis le marketplace d'organisation ou la CLI. Claude Code et Cursor le chargent depuis le même tag, par leur manifeste.

---

## 5. Flux d'exécution

1. **Cadrage** (directeur) : calcul du diff, détection de la stack, chargement de `rules.yml`, une seule fois.
2. **Choix du mode** : `fast`, `standard` ou `deep`, selon la commande et la taille du diff.
3. **Checks déterministes** : ArchUnit, dependency-cruiser, linters, audit des dépendances, scan de secrets.
4. **Deux pipelines en parallèle**, chacun dans son contexte isolé :
   - Revue : reviewers en parallèle, consolidation, dédoublonnage par `fichier:ligne`, `REVIEW.md`.
   - Sécurité : orchestrateur sécurité, findings vérifiés, rapports dans `<repo>/.review/runs/<run-id>/security/`, gitignorés avec le run.
5. **Routage des pistes croisées** : un indice de sécurité repéré par la revue est transmis au pipeline sécurité en `needs_validation`, sans rester dans le rapport de revue.
6. **Synthèse minimale** dans le terminal, avec compteurs uniquement.

Exemple de sortie du directeur :

```
Revue de code   → REVIEW.md           2 bloquants · 5 à corriger · 8 suggestions
Sécurité        → <dossier restreint> 1 confirmed · 2 needs_validation
Pistes croisées → 1 transmise à la sécurité
```

---

## 6. Séparation des deux rapports

| | Revue de code | Sécurité |
|---|---|---|
| Public | Le développeur, la PR | Développeur et équipe AppSec |
| Fichiers | `REVIEW.md` | `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `findings.json` |
| Verdicts | Bloquant, à corriger, suggestion | `confirmed`, `needs_validation`, `rejected` |
| Rigueur | Rapide, tolère des faux positifs | Chaque finding vérifié par un agent indépendant |
| Caveman | Oui, en interne | Non |
| Cadence | À chaque PR ou push | Diff en continu, deep planifié |
| Emplacement | Dans le run du repo (`audit/`), visible dans la PR | `<run>/security/`, gitignoré avec `.review/runs/`, accès restreint |

Règles de séparation :

1. Ponytail reste dans la revue et ignore la sécurité.
2. Aucun détail de finding de sécurité dans le rapport de revue (au mieux une ligne « des points ont été remontés au rapport sécurité »).
3. Le directeur ne reçoit que des compteurs du pipeline sécurité, pas le détail.
4. Le hook pre-push ne lance que la revue rapide. La sécurité fast est une commande séparée, activable dans la configuration.
5. Cas frontière : versions non épinglées et licences relèvent de la revue, les CVE relèvent de la sécurité.

---

## 7. Règles du directeur

- **Échecs indépendants** : si un pipeline plante ou dépasse son délai, l'autre rend son rapport, avec une mention claire de ce qui manque.
- **Code de sortie** : bloquant si la revue a un point bloquant, ou si la sécurité a un `confirmed` au-dessus d'un seuil de sévérité configurable.
- **Droits** : l'accès aux rapports sécurité est séparé de celui de la revue. Un développeur peut avoir `/review` sans `/security-deep`.
- **Budget** : plafond de tokens et de durée par mode, abandon propre au lieu d'un deep sans limite.
- **Plafond d'affichage** : 10 findings les plus importants dans `REVIEW.md`, le reste dans un fichier détaillé.

---

## 8. Plan par phases

Le détail exécutable (fichiers, contrats, tests d'acceptation) est dans [plans/README.md](plans/README.md). Ce document reste le cadre.

### Phase 0 : cadrage (2 à 3 jours)

- Choisir 2 repos pilotes (une stack, une architecture hexagonale).
- Faire valider avec la sécurité ou la DSI que le code peut être envoyé au modèle, et vérifier la disponibilité d'un sandbox sur les postes pour le mode deep.
- Rédiger `rules.yml` v0 : couches, imports interdits, nommage.
- **Livrables** : note de cadrage, `rules.yml` v0.

### Phase 1 : socle (1 semaine)

- `plugin.json`, marketplace interne, `vendor-lock.md`.
- Skills partagées : cadrage du diff, détection de stack, chargement des règles.
- Schémas de findings (revue et sécurité).
- **Critère d'acceptation** : le plugin s'installe depuis le marketplace et `/review` s'exécute à vide.

### Phase 2 : revue de code MVP (1,5 semaine)

- Orchestrateur de revue.
- Reviewers : architecture, nommage, tests, gestion d'erreurs.
- Script de checks déterministes, branché avant les agents.
- Génération de `REVIEW.md` plafonné.
- **Critère d'acceptation** : sur les 2 pilotes, un rapport en quelques minutes, sans doublons.

### Phase 3 : simplicité et économie de tokens (3 à 4 jours)

- Reviewer simplicité (Ponytail) avec consigne de respecter les couches imposées par l'ADR.
- Caveman en interne entre sous-agents, jamais dans les rapports.
- **Critère d'acceptation** : tokens mesurés avant et après, sans perte de findings sur le jeu de tests.

### Phase 4 : sécurité en mode fast (1 semaine)

- Orchestrateur sécurité et reviewer fast sur le diff.
- Contrat de sortie : verdicts `confirmed`, `needs_validation`, `rejected`, validés par les scripts de la skill.
- Rapports écrits dans `<repo>/.review/runs/<run-id>/security/`, gitignorés.
- **Critère d'acceptation** : un finding planté est détecté, validé par le schéma, et absent de `REVIEW.md`.

### Phase 5 : directeur et `/check` (3 à 4 jours)

- Cadrage unique, lancement parallèle, échecs indépendants.
- Routage des pistes croisées.
- Codes de sortie, seuils, budgets.
- **Critère d'acceptation** : `/check` produit les deux rapports séparés et une synthèse à compteurs.

### Phase 6 : sécurité deep (1 semaine)

- Skill Cloudflare complète, en commande à la demande ou en job planifié.
- Vérification des prérequis : Node.js, sous-agents parallèles, sandbox.
- **Critère d'acceptation** : un run complet sur un pilote, `findings.json` valide, rapports générés.

### Phase 7 : évaluation (en continu dès la phase 2)

- Jeu de tests : PR avec défauts plantés (violation hexagonale, nommage, faille connue, impact hors diff).
- Mesures : rappel, faux positifs, durée et coût par run.
- **Règle** : pas d'élargissement tant que le taux de faux positifs n'est pas jugé acceptable avec l'équipe pilote.

### Phase 8 : pilote et déploiement (2 semaines)

- 5 à 10 développeurs, retours hebdomadaires.
- Hook pre-push optionnel.
- Documentation courte et session de prise en main.
- Processus de mise à jour : nouveau tag, relecture des prompts figés, changelog.
- **Critère d'acceptation** : retours positifs de l'équipe pilote et aucun incident de données.

---

## 9. Axes de revue après la v1

À ajouter un par un, chacun avec ses cas de test.

**Code** : performance (N+1, requêtes non bornées, I/O en boucle), concurrence et idempotence, dette (TODO sans ticket, suppressions de lint).

**Données et contrats** : migrations (réversibilité, verrous), contrat d'API (ruptures, versionnage), impact hors diff, données personnelles dans les logs.

**Exploitation** : observabilité, configuration et feature flags, IaC et Docker, dépendances (versions, licences).

**Processus** : docs et ADR à jour, taille et description des PR, accessibilité et i18n pour le front.

---

## 10. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Trop de faux positifs | Les développeurs ignorent l'outil | Jeu de tests (phase 7), checks déterministes d'abord, plafond de 10 findings |
| Coût et durée des runs | Adoption freinée | Trois modes, budgets par mode, Caveman en interne |
| Données sensibles envoyées au modèle | Risque de conformité | Validation en phase 0, rapports dans `<run>/security/` gitignoré, accès séparé |
| Composants externes modifiés en amont | Prompts non relus sur les postes | Copies figées, `vendor-lock.md`, relecture avant chaque mise à jour |
| Conflit Ponytail et architecture hexagonale | Faux signalements de sur-ingénierie | Règles d'architecture passées en contexte, consigne explicite |
| Doublons entre reviewers | Rapport illisible | Périmètre exclusif par reviewer, dédoublonnage par `fichier:ligne` |
| Sandbox absent sur les postes | Mode deep limité à `needs_validation` | Vérification en phase 0, mode deep éventuellement en CI |
| Dérive des règles | Revue obsolète | Règles versionnées par repo, avec un responsable désigné |
| Télémétrie du CLI Caveman | Fuite de métadonnées d'usage | Ne pas installer le CLI, télémétrie désactivée |

---

## 11. Décisions à trancher tôt

1. Hôtes : corrigé en phase 0. Mistral Vibe, GitHub Copilot, Claude Code et Cursor chargent le même paquet. `CODE_CHECK_HOST` est la session. Reste l'endpoint de chaque surface installée.
2. Seuils bloquants du pre-push (revue et sécurité).
3. Propriétaire de la mise à jour des composants figés.
4. Emplacement et accès aux rapports de sécurité (dossier local, partage restreint, outil central).
5. Mode deep : poste développeur ou CI.
6. Liste des axes retenus pour la v1.

---

## 12. Indicateurs de succès

- Part des PR passées par `/review` avant ouverture.
- Taux de findings acceptés par les développeurs (proxy du taux de faux positifs).
- Défauts plantés détectés (rappel) sur le jeu de tests.
- Durée médiane d'un run par mode.
- Coût moyen en tokens par run avant et après Caveman.
- Nombre de findings de sécurité `confirmed` traités dans les délais définis.
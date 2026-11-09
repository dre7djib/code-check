# Note de cadrage

Statut : décisions de l'auteur, 9 novembre 2026. Ce dépôt est le produit à proposer aux entreprises. La phase 1 peut démarrer.

Machine relevée : poste macOS (darwin 25), utilisé comme machine type. Les constats d'installation et de sandbox valent pour ce poste.

## 1. Pilotes retenus

Ce dépôt ne contient que deux repos candidats. Les deux sont retenus. Il n'y a pas de troisième candidat à écarter. Ce sont les démos décrites dans [demos/README.md](../../demos/README.md) : mêmes couches, stacks différentes, pour vérifier que les règles ne sont pas en dur dans le plugin.

| | billing-hex | catalog-node |
|---|---|---|
| Rôle | Pilote hexagonal | Second pilote |
| Stack | Java 17, Maven, ArchUnit | TypeScript, dependency-cruiser |
| Architecture | Hexagonale. `support/` hors couches | Mêmes couches, autres chemins. `src/support/` hors couches |
| Domaine | `src/main/java/com/acme/billing/domain/**` | `src/domain/**` |
| Application | `src/main/java/com/acme/billing/application/**` | `src/application/**` |
| Adapters | `src/main/java/com/acme/billing/adapters/**` | `src/adapters/**` |
| Règles | `demos/billing-hex/.review/rules.yml` | `demos/catalog-node/.review/rules.yml` |
| Responsable des règles | le mainteneur de ce dépôt | le mainteneur de ce dépôt |

Le responsable des règles est la personne qui peut modifier `.review/rules.yml` (couches, imports interdits, nommage). Pour les deux démos, c'est le mainteneur de ce dépôt. Une entreprise qui adopte l'outil nomme la personne de l'équipe du repo.

### Relecture des `rules.yml`

Chaque `paths` correspond à un dossier qui existe. Les imports interdits retenus sont des préfixes présents dans le code.

Deux écarts ont été corrigés dans les fichiers :

- billing-hex citait `javax.persistence`. Aucun fichier du repo ne l'importe. `jakarta.persistence` est importé par l'adapter (`JpaInvoiceRepository`, `InvoiceEntity`). `org.springframework` est importé par le domaine (`InvoiceEventPublisher`) et par l'application. `javax.persistence` a été retiré de `forbidden_imports`. Le test ArchUnit (`ArchitectureTest`) le liste encore, en filet : ce préfixe n'est pas dans `rules.yml`.
- catalog-node citait `org.springframework.transaction.annotation.Transactional` dans `when_annotation`. Le décorateur du repo est la fonction locale `Transactional`. Le nom Spring a été retiré. `express` est importé par `src/domain/events/ProductEvents.ts`. `src/application` et `src/adapters` sont les préfixes de chemin déjà utilisés par `.dependency-cruiser.cjs`.

`support/` reste hors `layers` dans les deux fichiers.

## 2. Envoi du code au modèle

Oui. Le code des pilotes peut partir vers le modèle de l'agent qui exécute la commande. Aucun dossier n'est exclu.

La grille de ce qui quitte le poste est en annexe. Les rapports sécurité n'en font pas partie : ils restent dans `.review/<nom-du-repo>/runs/` (point 7).

## 3. Sandbox

Seatbelt est installé (`/usr/bin/sandbox-exec`). Docker Desktop 28.5.1 est installé. Ni l'un ni l'autre n'enferme l'agent : le même binaire s'exécute hors profil.

Binaire du repo : `demos/catalog-node/node_modules/.bin/tsc`.

Hors profil :

```
Version 5.7.2
code de sortie 0
```

Profil Seatbelt qui refuse par défaut :

```
sandbox-exec: execvp() of '/Users/dredjib/Documents/code-check/demos/catalog-node/node_modules/.bin/tsc' failed: Operation not permitted
code de sortie 71
```

Conséquence pour le deep : sur ce poste, le mode deep reste limité à `needs_validation`. La phase 6 n'exigera pas d'exécution locale du code de la cible. Docker n'a pas été retenu comme sandbox de l'agent.

## 4. Les six hypothèses

Référence : [plans/README.md](../README.md).

| # | Sujet | Décision de ce brouillon |
|---|---|---|
| 1 | Hôtes | Corrigée. Le plugin fonctionne sur chaque agent : Mistral Vibe, GitHub Copilot, Claude Code, Cursor. Détail au point 9. |
| 2 | Pre-push | Confirmée. Revue seule, hook désactivé. La valeur bloquante est au point 5. |
| 3 | Composants figés | L'équipe qui maintient ce dépôt. La mise à jour est une copie des Markdown (point 6). |
| 4 | Rapports sécurité | Corrigée. `<workspace>/.review/<nom-du-repo>/runs/` (point 7). |
| 5 | Mode deep | Corrigée. Seatbelt et Docker sont sur la machine, et l'agent n'est pas enfermé. Le deep de ce poste reste en `needs_validation`. |
| 6 | Axes v1 | Confirmée. Les deux `rules.yml` activent architecture, nommage, tests, erreurs, simplicité. La section 9 du plan v1 reste hors livraison. |

## 5. Seuil pre-push

Validé. Les deux fichiers sont déjà dans cet état : `pre_push.enabled: false`, `pre_push.blocking: false`. Le hook est désactivé au pilote.

Valeur bloquante le jour où le hook sera armé, écrite maintenant pour ne pas la redéfinir plus tard :

- `enabled: true`, `blocking: true` ;
- le hook échoue, code de sortie 1, seulement si la revue produit un finding de sévérité `blocking` ;
- `fix` et `suggestion` ne font pas échouer le hook ;
- la sécurité ne part pas avec le hook.

## 6. Propriétaire des composants figés

L'équipe qui maintient ce dépôt. Le champ `author.name` du `plugin.json` vaut `code-check`.

La mise à jour de Ponytail, Caveman et la skill Cloudflare consiste à copier leurs fichiers Markdown dans le plugin, sur un commit relu. `vendor-lock.md` enregistre l'origine, le commit, la licence et la date. Pas d'installation dynamique, pas de `npx skills add` au runtime.

## 7. Rapports sécurité

Un workspace peut contenir plusieurs repos. Les rapports sécurité sont à la racine du workspace :

```
<workspace>/.review/<nom-du-repo>/runs/<run-id>/
```

Exemple : `.review/billing-hex/runs/` et `.review/catalog-node/runs/`. `<nom-du-repo>` est le nom du dossier du dépôt. Deux dépôts du même nom se distinguent par les 12 premiers hex du SHA-256 de leur chemin. `<run-id>` sépare les runs.

La revue de code reste dans le repo examiné : `<repo>/.review/runs/<run-id>/`. `rules.yml` reste versionné dans ce repo. Les deux arbres ne se mélangent pas.

| | Valeur |
|---|---|
| Chemin | `<workspace>/.review/<nom-du-repo>/runs/<run-id>/` |
| Remplacement | `CODE_CHECK_SECURITY_DIR`, si une entreprise veut un autre lieu. La forme `<nom-du-repo>/runs/<run-id>/` reste. |
| Permissions | `0700` à la création |
| Rétention | 30 jours |
| Synchronisation | aucune, pas de copie cloud |
| Git | `/.review/` est dans le `.gitignore` du workspace. Les rapports ne sont pas commités. |
| Lecteurs | le compte système qui possède le dossier. Le directeur reçoit les compteurs, pas le détail. |

Un workspace qui n'ouvre qu'un seul repo garde la même forme, à sa racine.

## 8. Seuil de faux positifs

Validé. Le nombre est **30**.

Mesure : sur les 10 premières PR réelles, part des findings affichés dans `REVIEW.md` que l'équipe rejette. La suite (élargissement des axes, phase 8) est autorisée si cette part est inférieure à 30 %. Au-delà, on ne s'élargit pas.

## 9. Hôtes

Le plugin fonctionne sur chaque agent. Les skills, `rules.yml`, les schémas et les rapports sont les mêmes. Chaque hôte a un adaptateur court, qui pointe vers `agents/` et ne recopie pas la procédure.

| Hôte | `CODE_CHECK_HOST` | Adaptateur | Sur ce poste |
|---|---|---|---|
| Mistral Vibe, CLI et extension VS Code | `mistral` | `ai.mistral.vibe/agents/` | absent (`mistral` et `vibe` absents). L'adaptateur est livré quand même. |
| GitHub Copilot, CLI, VS Code, app | `copilot` | `com.github.copilot/agents/` | CLI, VS Code et app absents. |
| GitHub Copilot, extension dans Cursor | `copilot` | le même adaptateur | présent : `github.copilot` 1.270.0, `github.copilot-chat` 0.23.2 |
| Claude Code | `claude` | `.claude-plugin/plugin.json` | CLI 2.1.316 |
| Cursor | `cursor` | `.cursor-plugin/plugin.json`, agents dans `cursor/agents/` | cette session |

L'endpoint est le service du modèle de l'agent qui exécute la commande. L'adresse exacte n'a pas été capturée dans cette session. Le point 2 autorise cet envoi, sans dossier exclu. Une entreprise qui adopte l'outil nomme les services qu'elle autorise. L'agent cloud Copilot reste hors du poste (annexe).

Une phase se rejoue sur chaque hôte installé ici : Cursor, Claude Code, extension Copilot. Un hôte absent du poste reste dans le paquet. Il n'est pas marqué réussi. Son premier run réel est une ligne du changelog.

## 10. `CODE_CHECK_HOST`

La variable est celle de la session, posée par l'adaptateur de l'agent qui tourne. Il n'y a pas une valeur unique par équipe.

| Session | `CODE_CHECK_HOST` |
|---|---|
| Cursor | `cursor` |
| Claude Code | `claude` |
| Copilot | `copilot` |
| Mistral Vibe | `mistral` |

Le hook lit cette variable et lance cet hôte. Si le binaire manque, il affiche le message et sort 0. Il ne lance pas un autre agent à la place.

## Annexe — Grille d'envoi

Quatre catégories quittent le poste, vers le service du modèle de l'agent de la session. Le point 2 autorise cet envoi. Aucune de ces catégories ne revient dans `.review/<nom-du-repo>/runs/`. La grille est la même pour chaque agent.

| Catégorie | Quitte le poste | Reste dans le repo | Revient au directeur |
|---|---|---|---|
| Diff | oui | le diff d'origine est déjà dans git ; la copie envoyée part vers l'hôte | non |
| Fichiers lus autour du diff | oui | non | non |
| `rules.yml` | oui | le fichier versionné reste dans `.review/` ; la copie part vers l'hôte | non |
| Sorties des outils déterministes | oui | `.review/runs/`, non commité ; la copie part vers l'hôte | non |
| Rapports sécurité | non | `.review/<nom-du-repo>/runs/`, gitignoré | compteurs seuls (`confirmed`, `needs_validation`, `rejected`, statut) |

Ligne distincte, agent cloud Copilot (runner GitHub, hors du poste) : **non**. Il n'est pas installé, et aucun périmètre du point 2 ne le couvre. Le passer à oui demande une ligne d'endpoint et un accord explicite dans cette note.

## Décision

Ces choix sont ceux de l'auteur du dépôt, le 9 novembre 2026. Il n'y a pas de responsable pilote ni d'interlocuteur sécurité à faire signer : ce dépôt n'est pas le déploiement d'une entreprise. C'est le produit à leur proposer.

Une entreprise qui l'adopte écrit sa propre note pour trois choses : qui modifie `.review/rules.yml` dans ses repos, quels services de modèle elle autorise, et le lieu des rapports si elle ne garde pas `.review/<nom-du-repo>/runs/` dans le workspace.

Aucune case ne bloque la phase 1.

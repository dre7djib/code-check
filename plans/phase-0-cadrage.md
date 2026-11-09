# Phase 0 — Cadrage

Durée : 2 à 3 jours. Pas de code plugin. La sortie est une note signée et deux `rules.yml` relus.

## Objectif

Rendre les six décisions de la section 11 du plan v1 explicites, et produire les règles v0 des deux repos pilotes. Sans cette note, la phase 1 n'a pas de propriétaire, pas de lieu pour les rapports sécurité, et pas de jeu d'essai.

## Prérequis

- Accès en lecture aux repos candidats.
- Un interlocuteur sécurité ou DSI pour la question « le code peut-il partir vers le modèle ».
- Un interlocuteur qui peut dire si les postes ont un sandbox OS utilisable par l'agent (Seatbelt, conteneur, ou équivalent). Le mode deep en a besoin pour exécuter du code de la cible. Sans sandbox, la skill Cloudflare laisse la piste en `needs_validation`.

## Hors périmètre

- Écrire le plugin, le marketplace, ou un script.
- Choisir les axes de la section 9.
- Décider d'une CI centrale.

## Livrables

| Livrable | Emplacement |
|---|---|
| Note de cadrage | `plans/cadrage/note.md` (créée par cette phase, pas maintenant) |
| `rules.yml` v0 du pilote hexagonal | dans le repo pilote, `.review/rules.yml` |
| `rules.yml` v0 du second pilote | dans le repo pilote, `.review/rules.yml` |
| Grille de ce qui part vers le modèle | annexe de la note |

La note tient en quatre pages. Elle répond, dans cet ordre :

1. Pilotes retenus : nom du repo, stack, architecture, personne responsable des règles.
2. Décision sur l'envoi de code au modèle : oui, non, ou oui avec exclusions (dossiers, secrets, jeux de données). Liste des dossiers exclus.
3. Sandbox : présent ou absent sur les postes du pilote. Conséquence pour le deep (poste, ou deep limité à `needs_validation`).
4. Les six hypothèses de [README.md](README.md), confirmées ou corrigées.
5. Seuil pre-push : désactivé au pilote, ou actif en avertissement. La valeur bloquante, si un jour elle est armée, est écrite ici.
6. Propriétaire des composants figés (nom et équipe).
7. Chemin du dossier des rapports sécurité et qui a le droit d'y lire.
8. Seuil de faux positifs qui autorise la suite : proposition à faire valider, défaut « moins de 30 % des findings affichés rejetés par l'équipe sur les 10 premières PR réelles ».
9. Hôtes : Mistral Vibe, GitHub Copilot, Claude Code et Cursor. Le plugin fonctionne sur chacun, mêmes skills et mêmes rapports, un adaptateur par hôte. Pour chaque surface installée : l'endpoint qui reçoit le code. Une surface dont le code sort du périmètre accepté par la DSI est retirée, même si l'outil est installé.
10. `CODE_CHECK_HOST` est la session (`mistral`, `copilot`, `claude`, `cursor`), posé par l'adaptateur de l'agent qui tourne. Pas une valeur unique par équipe.

## Tâches

1. Lister trois repos candidats. En retenir deux : un avec une architecture hexagonale déjà documentée (ADR ou packages `domain` / `application` / `adapters`), un second sur la même stack ou une stack voisine pour vérifier que les règles ne sont pas en dur dans le plugin.
2. Pour chaque pilote, écrire `rules.yml` v0 à partir du modèle de [00-conventions.md](00-conventions.md). Remplir `layers`, `forbidden_imports` et la règle de suffixe `Transactional` avec les vrais packages. Faire relire par un développeur du repo. Le fichier est versionné dans le repo pilote, pas dans ce dépôt.
3. Décrire, dans la grille d'envoi, les quatre catégories qui quittent le poste : diff, fichiers lus autour du diff, `rules.yml`, sorties des outils déterministes. Préciser vers quel endpoint, par hôte. Préciser que les rapports sécurité ne reviennent pas dans le repo ni dans le contexte du directeur. L'agent cloud Copilot, qui travaille sur un runner GitHub, est une ligne distincte : oui ou non.
4. Vérifier le sandbox sur une machine type du pilote : lancer l'agent, lui demander d'exécuter un binaire du repo dans le sandbox, noter si l'exécution est refusée. Coller le résultat dans la note, sans procédure de contournement.
5. Trancher le lieu des rapports. La note retient `<workspace>/.review/<nom-du-repo>/runs/<run-id>/`, `0700`, rétention 30 jours, gitignoré, pas de synchronisation cloud. Un workspace à plusieurs repos a un sous-dossier par repo. `CODE_CHECK_SECURITY_DIR` permet à une entreprise d'en choisir un autre. La phase 4 lit la note.
6. Nommer le propriétaire des bumps Ponytail, Caveman et Cloudflare.
7. Faire signer la note quand le déploiement est celui d'une entreprise. Pour ce dépôt, l'auteur tranche : le produit est à proposer, et la phase 1 démarre sur la note.

## Acceptation

- Les deux `rules.yml` passent une relecture humaine : chaque `paths` correspond à un dossier qui existe, chaque import interdit est un préfixe réellement utilisé dans le repo.
- La note répond aux dix points de la section Livrables. Une case vide bloque la phase 1.
- Les quatre hôtes sont dans le paquet. La note dit, pour chacun, s'il est installé sur le poste. Une phase ultérieure rejoue son scénario sur chaque hôte installé.
- Le seuil de faux positifs est un nombre, pas une formule à redéfinir plus tard.

## Risques propres

| Risque | Parade dans cette phase |
|---|---|
| Aucun repo hexagonal propre | Choisir le moins mauvais et documenter les entorses dans `rules.yml` (`may_import` explicites) plutôt que de coder une exception dans le plugin. |
| Refus d'envoyer le code au modèle | Stop. Le plugin ne se fait pas. La note le dit. |
| Sandbox absent | Le noter. La phase 6 n'exigera pas d'exécution locale ; les findings deep resteront `needs_validation`. |

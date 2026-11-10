# Phase 4 — Sécurité en mode fast

Durée : 5 jours. Un finding planté sur le diff est détecté, validé par le schéma Cloudflare, écrit dans `.review/<nom-du-repo>/runs/`, et absent de `REVIEW.md`.

## Objectif

Pipeline sécurité court : un chasseur sur le diff, un vérificateur qui ne voit pas le raisonnement du chasseur, une écriture `findings.json` que les scripts Cloudflare acceptent. Pas les six phases deep.

## Prérequis

- Phase 1 acceptée. La preuve « absent de `REVIEW.md` » exige aussi la phase 2, parce qu'elle compare les deux rapports sur le même run. On peut développer le pipeline sécurité dès la phase 1 finie ; on ne signe l'acceptation qu'une fois la revue MVP en place.
- Note de cadrage : chemin du dossier sécurité et droit d'y écrire.
- Node.js disponible sur le poste (les validateurs Cloudflare sont des `.cjs` sans dépendance).
- Commit Cloudflare relu. En phase 4 on copie seulement ce qui valide et décrit le contrat de sortie, pas toute la méthodologie de chasse deep.

Fichiers copiés au minimum :

```
skills/security-audit/SKILL.md
skills/security-audit/references/report-schema.json
skills/security-audit/references/VALIDATION-AND-REPORTING.md
skills/security-audit/scripts/validate-findings.cjs
skills/security-audit/scripts/validate-findings.test.cjs
```

Les chemins internes ont bougé (validators sous `scripts/`, schéma sous `references/`). Au moment de la copie, suivre l'arborescence du commit épinglé, pas cette liste si elle a encore bougé. Lancer `node --test` sur les tests copiés : ils doivent passer sans modification. Si un test échoue parce qu'un chemin relatif a été cassé par la copie, corriger le chemin dans le fichier copié et le noter dans `vendor-lock.md`. Ne pas « simplifier » le validateur.

Le reste de la skill (chasse, classes d'attaque, ledger) arrive en phase 6. `vendor-lock.md` dit « copie partielle, phase 4 » et le SHA.

## Hors périmètre

- Les six phases, le coverage ledger, le mode deep.
- Confirmer un finding sans citation et sans vérificateur indépendant.
- Écrire un schéma de finding parallèle. `findings.json` est conforme à `report-schema.json` vendoré.
- Caveman sur ce pipeline.
- Montrer un titre de finding au directeur ou dans `REVIEW.md`.

## Fichiers maison

```
agents/security/orchestrator.md
agents/security/fast.md
skills/security-contract/SKILL.md
scripts/prepare-security-dir.sh
```

`agents/security/fast.md` est le chasseur. Le vérificateur est le même fichier de consignes lancé dans un agent neuf, avec un prompt différent (section 3), pas un second personnage qui partagerait le contexte.

## Contrat de sortie

Trois verdicts, tels que la skill les définit. Rappel opératoire, le schéma vendor fait foi :

| Verdict | Exigence fast |
|---|---|
| `confirmed` | Citation présente dans le fichier à la ligne dite, cause, conditions, exécution locale décrite, remédiation, sévérité. Le vérificateur n'a pas réussi à l'invalider. En fast, sans sandbox, ne pas utiliser `confirmed` : rester en `needs_validation`. Le sandbox fast n'est pas exigé en v1. |
| `needs_validation` | Citation, cause prétendue, bloqueur précis, un plan de validation local ou de déploiement. C'est le verdict normal du mode fast. |
| `rejected` | Le vérificateur a montré que la piste est fausse. On la garde pour ne pas la réouvrir au run suivant sur le même diff. |

`security-contract` résume ces trois lignes et interdit d'inventer un quatrième verdict. Il pointe le schéma vendor. Il rappelle que le directeur ne reçoit que le résumé de `schemas/security-findings.schema.json`.

## Tâches

### 1. Dossier `.review/<nom-du-repo>/runs`

`scripts/prepare-security-dir.sh <nom-du-repo> <run-id>` crée `<workspace>/.review/<nom-du-repo>/runs/<run-id>` en `0700`. `<nom-du-repo>` est le nom du dossier du dépôt. Si `CODE_CHECK_SECURITY_DIR` est posé, ce chemin remplace `<workspace>/.review`. Le script écrit le chemin dans `security-dir.path` sous le run de revue. Ce fichier contient un chemin, pas un finding. Il est gitignoré avec le run de revue. `/.review/` du workspace l'est aussi.

### 2. Chasseur fast

Entrée : `diff.patch`, `context.json`, `security-seeds.json` s'il existe, `cross-hints.json` s'il existe. Pas le reste du repo, sauf lecture des fichiers touchés et de leurs appelants directs quand la signature d'un point d'entrée (contrôleur, parser, middleware) change.

Périmètre : injection, désérialisation, secret dans le diff, contrôle d'accès manquant sur une route touchée, CVE listée dans les seeds. Hors périmètre : revue de style, nommage, architecture.

Sortie intermédiaire : candidats JSON dans `.review/<nom-du-repo>/runs/<run-id>/`. Chaque candidat cite `file`, `line`, `quote` recopié du fichier.

Une seed CVE ou un secret gitleaks devient un candidat, pas un `confirmed` automatique. Le vérificateur décide.

### 3. Vérificateur

Nouvel agent, outils `Read`, `Grep`, `Glob`. Il reçoit le candidat et le fichier, pas le transcript du chasseur. Sa consigne : tenter d'invalider. S'il invalide, `rejected` avec la raison. S'il ne peut pas exécuter, `needs_validation` avec le bloqueur « pas d'exécution locale en mode fast ». Il ne promeut pas en `confirmed` en mode fast.

### 4. Écriture et validation

L'orchestrateur écrit `findings.json` trié par fingerprint, puis :

```
node skills/security-audit/scripts/validate-findings.cjs \
  <dossier>/findings.json --target <repo>
```

Échec du validateur : ne pas publier les markdown. Réécrire une fois en corrigeant les champs refusés. Deuxième échec : `status: failed`, aucun `REPORT.md`, code 2.

Markdown dérivés du JSON validé, dans le dossier sécurité seulement :

- `REPORT.md` : compteurs et liste courte des `needs_validation` et `confirmed`.
- `FINDINGS-DETAIL.md` : fiches.
- `NEEDS-VALIDATION.md` : bloqueur et plan, un par piste.
- `PRIORITIES.md` : classement P1/P2/P3 avec liens `fichier#Llignes` cliquables.

Puis écrire le résumé compteurs au schéma `security-findings.schema.json` dans le dossier sécurité (`summary.json`). C'est l'unique objet lisible par le directeur en phase 5. En phase 4, la commande `security` affiche ces compteurs dans le terminal et le chemin du dossier. Elle n'affiche pas de titre de finding dans le terminal. Le même scénario est rejoué sur chaque hôte installé.

### 5. Pistes croisées

Si `cross-hints.json` est non vide, chaque entrée devient un candidat `needs_validation` dont le bloqueur initial est « indice venu de la revue de code, non vérifié ». Le vérificateur fait le même travail que pour un candidat du chasseur. Un indice non retrouvé dans le code est `rejected`.

### 6. Cas planté

Dans `eval/fixtures/security-fast/` : un mini-repo dont le diff concatène une entrée HTTP dans une requête SQL (ou l'équivalent de la stack pilote). Attendu :

- `findings.json` valide ;
- au moins une entrée `needs_validation` (ou `confirmed` si, et seulement si, un sandbox a réellement exécuté la requête) sur ce fichier ;
- `REVIEW.md` du même run, produit par la phase 2, ne contient ni la citation, ni le mot « SQL », ni le nom du finding. La seule phrase autorisée est « Des points ont été transmis au rapport sécurité. »

Le test d'absence est un script : `scripts/assert-review-has-no-security.sh <REVIEW.md> <findings.json>` échoue si un `title`, une `quote` ou un `file`+ligne de finding sécurité apparaît dans le markdown de revue. Les noms de fichiers anodins peuvent être partagés (le même fichier peut avoir un finding de nommage) : on compare les titres et les citations, pas les chemins seuls.

## Acceptation

1. `node --test` des tests vendor passe.
2. Le cas planté est détecté sur chaque hôte installé, et le validateur sort 0 avec `--target`.
3. `assert-review-has-no-security.sh` sort 0 sur ce run.
4. Le dossier sécurité est `.review/<nom-du-repo>/runs/<run-id>` à la racine du workspace, en `0700`, et `/.review/` est gitignoré (`stat` collé dans la note de run de la phase). Deux repos du même workspace n'écrivent pas dans le même sous-dossier.
5. Un run sans diff vulnérable produit un `findings.json` vide valide, ou un fichier de rejets seulement, et un code 0.
6. Version `0.4.0`. `vendor-lock.md` distingue la copie partielle de la copie complète à venir.

## Risques propres

| Risque | Parade |
|---|---|
| Le mode fast marque `confirmed` sans exécution | Interdit par le prompt et par un test : sur le fixture, sans sandbox, le verdict n'est pas `confirmed`. |
| Le schéma vendor évolue | On ne l'édite pas. On épingle le commit. Un champ refusé se corrige dans notre writer, pas dans le schéma. |
| Double signalement revue + sécurité sur la même ligne | La revue peut garder un finding de nommage sur cette ligne. Elle ne peut pas garder le texte sécurité. Le script d'assertion couvre ce cas. |

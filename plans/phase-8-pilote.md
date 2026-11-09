# Phase 8 — Pilote et déploiement

Durée : 10 jours ouvrés, dont du temps d'attente des retours. Groupe de 5 à 10 développeurs, les deux repos de la phase 0 plus les personnes qui les modifient.

## Objectif

Le plugin tagué `0.6.0` (ou le patch suivant si l'évaluation a corrigé des prompts) est utilisé sur des PR réelles, le hook reste optionnel, et aucune donnée de rapport sécurité n'apparaît dans un dépôt ou un ticket ouvert.

## Prérequis

- Phases 5 et 6 acceptées.
- Fixtures v1 verts (phase 7).
- Le seuil de faux positifs n'a pas besoin d'être déjà tenu pour commencer le pilote : le pilote est ce qui le mesure. Il doit l'être avant d'élargir au-delà de ces 5 à 10 personnes.
- Note de cadrage toujours valable (envoi du code au modèle, lieu des rapports).

## Hors périmètre

- Rendre le hook obligatoire.
- Tableau de bord, CI centrale, axes de la section 9.
- Correctifs automatiques autres que le nommage et les imports marqués `autofix: safe`.

## Fichiers

```
scripts/install-pre-push.sh
scripts/run-review.sh
skills/review-fix/SKILL.md
README.md                         # réécrit pour l'utilisateur pilote
CHANGELOG.md
docs/prise-en-main.md             # une session, pas un manuel
```

## Tâches

### 1. Documentation courte

`README.md` tient sur un écran :

- installer `code-check` au tag, par l'hôte du poste, pas en suivant la branche ;
- déposer `.review/rules.yml` (lien vers `templates/rules.example.yml`) ;
- les commandes et le préfixe réel de chaque hôte ;
- où est `REVIEW.md` (`.review/runs/...`, non commité, à coller dans la PR si l'équipe le veut) ;
- où sont les rapports sécurité, qui peut lancer `security-deep`, et le fait que `security.access` est une politique de repo, pas un verrou par personne ;
- quoi faire d'un finding : accepter, rejeter (une ligne dans `eval/fp-log.md` via le canal de l'équipe), ou corriger.

`docs/prise-en-main.md` est le script de la session d'une heure : installer sur l'hôte du poste, lancer `review` sur une PR en cours, lire le plafond de 10, montrer qu'un rapport sécurité n'est pas dans le repo. Pas de slide. Le groupe pilote comprend des utilisateurs de chaque hôte installé.

### 2. Hook pre-push optionnel

Deux mécanismes, le second seulement si le premier est trop fragile sur les postes. On n'active les deux à la fois nulle part.

**Mécanisme retenu : hook git installé à la demande.** `scripts/install-pre-push.sh` copie un hook `pre-push` dans `.git/hooks/` du repo cible, après confirmation interactive. Le hook :

- ne fait rien si `rules.yml` a `pre_push.enabled: false` (défaut) ;
- lance la revue en mode fast seulement ;
- ne lance pas la sécurité ;
- si `pre_push.blocking` est false : affiche le résumé et sort 0 quand le code revue est 1, pour ne pas bloquer le push pendant le pilote ;
- si `pre_push.blocking` est true : propage le code 1. La note de cadrage doit avoir coché ce choix. Défaut : false.
- un code 2 ou 3 affiche l'erreur et sort 0 en pilote (un plugin cassé ne bloque pas le push). Le changelog dira quand ce choix sera durci.

Le hook appelle `scripts/run-review.sh`. Le script lit `CODE_CHECK_HOST` (`mistral`, `copilot`, `claude` ou `cursor`, posé par la session) et lance la revue fast sur cet hôte. Si le binaire correspondant n'est pas dans le PATH, le hook sort 0 avec un message. Il ne lance pas un autre agent.

On n'intercepte pas les commandes shell de l'agent pour détecter `git push` : trop de faux déclenchements. Le hook git est le seul mécanisme v1, commun à chaque hôte.

`install-pre-push.sh` refuse d'écraser un `pre-push` déjà présent sans `--force` explicite, et `--force` n'est pas utilisé par la doc de prise en main.

### 3. Commande `review-fix`

Skill `skills/review-fix/SKILL.md`, séparée, jamais appelée par `review` ni par le hook. Même comportement sur chaque hôte.

Périmètre : findings de `merged.json` dont `autofix` vaut `safe`. En v1, seuls deux cas le portent :

- nommage : renommer le type pour ajouter le suffixe exigé, et les références dans le même diff que le langage permet de retrouver par recherche exacte du nom ;
- import : réordonner ou supprimer un import inutilisé seulement quand le linter du repo a une action de correction déjà scriptée (`lint --fix` limité à ces règles).

Défaut : dry-run, qui imprime le diff unifié et n'écrit rien. L'application demande un argument `apply` dans la commande. Pas de commit. Pas de finding `blocking` architecture « corrigé » par un déplacement de classe : ce n'est pas sûr.

Un cas `eval/fixtures/naming-transactional` en dry-run doit montrer le nouveau nom et laisser le fichier intact. Le test d'application tourne sur une copie du fixture, pas sur un pilote.

### 4. Processus de mise à jour

Documenté dans `README.md`, appliqué au premier patch :

1. Branche, changement de prompt ou de vendor.
2. Fixtures verts.
3. Relecture du diff des fichiers sous `skills/ponytail`, `skills/caveman`, `skills/security-audit` par le propriétaire nommé. Même si le changement est un prompt maison, le propriétaire est informé quand le bump vendor est dans le même tag.
4. `CHANGELOG.md` : ce qui change pour un développeur, pas la liste des fichiers.
5. Tag `vX.Y.Z`. Le marketplace épingle ce tag. Pas de `latest`.
6. Les postes pilotes mettent à jour explicitement. On ne pousse pas le plugin à distance.

`vendor-lock.md` et le tag bougent ensemble. Un tag sans ligne vendor à jour est un tag refusé.

### 5. Déroulé des deux semaines

| Jour | Action |
|---|---|
| 1 | Session de prise en main, installation, une revue accompagnée par personne. |
| 2 à 4 | Chaque PR du pilote passe par `review` avant ouverture, sur l'hôte habituel du développeur. Le lien ou le collage de `REVIEW.md` est le geste demandé. |
| 5 | Point d'une heure : faux positifs, durée, trou dans `rules.yml`. Corriger les règles dans les repos pilotes d'abord. Ne toucher au prompt que si la règle est déjà juste et le finding faux. |
| 6 à 9 | Deuxième tour. Sécurité fast sur les PR qui touchent un point d'entrée, deep une fois sur un pilote, en séance, pas en tâche de fond. |
| 10 | Décision : rester en pilote, élargir, ou retirer. La décision est un paragraphe dans `eval/fp-log.md`. |

Canal de retour : un ticket par faux positif, pas un canal où l'on colle des extraits de rapport sécurité. La consigne de session le dit. Un extrait de finding sécurité dans un ticket ouvert est l'incident de données que le critère d'acceptation interdit. Si ça arrive : retirer le contenu, le noter comme incident, ne pas élargir.

### 6. Indicateurs lus en fin de pilote

Reprendre la section 12 du plan v1, avec les chiffres du groupe seulement :

- part des PR ouvertes après un run `review` (demander le run id dans la description, ou compter les dossiers de run ; ne pas builder de collecteur) ;
- taux de rejets dans `fp-log.md` ;
- rappel des fixtures, déjà connu avant le pilote, revérifié le jour du tag pilote ;
- durée médiane fast et standard ;
- caractères ou tokens avant / après Caveman, depuis `token-report.md` ;
- nombre de `confirmed` sécurité, et s'ils ont un responsable et une date. Pas leur contenu dans ce décompte.

## Acceptation

1. Les 5 à 10 personnes ont lancé au moins une revue. La liste est dans la note de fin de pilote (prénoms ou identifiants d'équipe, pas une exportation de rapports).
2. Retours : le point du jour 5 a eu lieu et au moins un `rules.yml` a été ajusté, ou la note explique pourquoi aucun ajustement n'était nécessaire.
3. Aucun incident de données : recherche convenue avec l'équipe (tickets du pilote, messages de la session) sans contenu de `findings.json`. Zéro occurrence.
4. Le hook, sur une machine volontaire de chaque hôte, n'empêche pas le push quand `blocking` est false, et n'appelle pas la commande `security`.
5. `review-fix` en dry-run ne modifie pas le fixture. `git status` propre après la commande.
6. Tag de pilote (`0.6.x` ou `0.7.0` si le correctif de prompts le mérite) et marketplace mis à jour sur ce tag.

## Risques propres

| Risque | Parade |
|---|---|
| Le hook bloque une mise en production un vendredi | Défaut non bloquant, sécurité absente du hook, code 3 ignoré par le hook. |
| Les rapports sécurité finissent dans la PR « pour aller plus vite » | Consigne de session, et la revue de code n'a pas le texte. Si un pilote colle un `REPORT.md`, c'est l'incident de la tâche 5. |
| Deux semaines sans chiffre | `fp-log.md` est tenu dès la première PR, pas reconstruit le jour 10. |

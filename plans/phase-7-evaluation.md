# Phase 7 — Évaluation

En continu dès le premier reviewer de la phase 2. Environ 2 jours pour le harnais, puis une heure à chaque phase qui ajoute un axe.

## Objectif

Savoir, avant d'élargir, si les défauts plantés sont retrouvés et si les vrais rapports noient les pilotes. Pas d'axe nouveau (section 9 du plan v1, ou simplicité avant que l'architecture soit stable) tant que l'équipe pilote n'a pas jugé le taux de faux positifs acceptable.

## Prérequis

- Phase 1, pour avoir le plugin installable sur chaque hôte.
- Le seuil chiffré de la note de cadrage. Défaut proposé en phase 0 : moins de 30 % des findings affichés sur les 10 premières PR réelles sont rejetés par l'équipe.

## Hors périmètre

- Un tableau de bord hébergé.
- Scorer la sécurité deep sur un grand corpus. Un fixture fast et un contrôle manuel du run deep suffisent en v1.
- Rendre le harnais bloquant en CI entreprise. Il bloque seulement le tag du plugin.

## Fichiers

```
eval/README.md
eval/fixtures/<cas>/          # mini-repos git, un défaut chacun
eval/expected/<cas>.json      # findings attendus : id, axis, severity, file, line
eval/score.mjs
eval/fp-log.md                # saisi à la main pendant le pilote
eval/token-report.md          # produit en phase 3
```

Les fixtures sont du code écrit pour l'occasion, petit, sans secret réel. Pas une copie des repos pilotes.

## Jeu de cas

Chaque cas a un `expected` minimal : l'id de règle, l'axe, la sévérité, le fichier, la ligne. Le score ne compare pas le titre (le modèle varie). Il compare axe + règle + fichier + ligne, avec une tolérance de ±2 lignes.

| Cas | Phase qui l'ajoute | Attendu |
|---|---|---|
| `hex-import` | 2 | `architecture`, `blocking`, import Spring dans `domain` |
| `hex-ok` | 2 | zéro finding architecture sur un port et un adapter conformes |
| `naming-transactional` | 2 | `naming`, `fix` |
| `missing-test` | 2 | `tests`, sévérité de `rules.yml` |
| `empty-catch` | 2 | `errors` |
| `port-not-bloat` | 3 | zéro finding `simplicity` |
| `needless-factory` | 3 | un finding `simplicity` |
| `security-sql` | 4 | finding sécurité hors revue ; `REVIEW.md` sans la citation |
| `dup-line` | 2 | deux agents signalent la même ligne : une seule entrée `merged.json` |
| `unpinned-dep` | 2 | suggestion revue, pas un CVE |
| `cve-seed` | 4 | présent dans `security-seeds` / `findings.json`, absent du titre de `REVIEW.md` |

Un cas qui échoue bloque le tag de la phase qui l'a introduit. Il ne bloque pas rétroactivement une phase déjà taguée : on ouvre un correctif sur la branche suivante.

## Tâches

### 1. Harnais

`eval/score.mjs` prend un dossier de run et un `expected.json`. Sortie :

- rappel : attendus retrouvés / attendus ;
- inattendus : findings produits qui ne matchent aucun attendu (candidats faux positifs sur fixture) ;
- code 0 si le rappel est 1 sur ce fixture, sinon 1.

`eval/run-all.sh` enchaîne les fixtures sur chaque hôte installé. `CODE_CHECK_HOST` nomme l'hôte du passage en cours. Il ne pousse rien, n'appelle pas le deep, n'écrit pas dans `.review/<nom-du-repo>/runs/` sauf le fixture `security-sql`, et efface ce dossier de fixture en fin de run. Un rappel de 1 sur un seul hôte ne valide pas le cas.

Le README de `eval/` dit comment lancer un cas seul. Un cas sécurité ne s'exécute que si `CODE_CHECK_SECURITY_DIR` est un répertoire temporaire créé par le script.

### 2. Mesures sur PR réelles

Dès que la phase 2 tourne sur un pilote, tenir `eval/fp-log.md` :

```
| Date | Repo | Run | Affichés | Rejetés par l'équipe | Acceptés | Durée |
```

« Rejeté » = un développeur du pilote dit que le finding ne devrait pas être dans le rapport. On ne compte pas un finding accepté mais reporté. Le taux est rejets / affichés, sur les findings de `REVIEW.md` (donc le plafond de 10), pas sur le détail. C'est ce que les gens lisent.

Dix PR ou deux semaines, le premier des deux. Ensuite comparer au seuil de la note de cadrage.

La durée médiane par mode est la colonne Durée. Le coût tokens reprend `eval/token-report.md` (phase 3) et, en pilote, `usage.json` quand il existe.

### 3. Règle d'élargissement

Avant d'ajouter un axe de la section 9, les trois cases sont cochées dans `eval/README.md` :

- rappel 1 sur tous les fixtures de la v1 ;
- taux de rejets sous le seuil sur les 10 PR ;
- durée médiane standard sous 15 minutes.

Sinon l'axe n'est pas commencé. La phase 3 (simplicité) est déjà dans la v1 : elle attend seulement que les fixtures de la phase 2 soient verts, pas les 10 PR. Les 10 PR bloquent la section 9 et le déploiement élargi de la phase 8 au-delà du groupe pilote.

### 4. Ce qu'on ne « répare » pas dans le score

Un finding juste, mal classé en sévérité, est un échec de score (la sévérité fait partie de l'attendu). On ajuste le prompt ou la règle, pas l'attendu, sauf si l'attendu contredit `rules.yml`. Dans ce cas l'attendu change et la raison est une ligne dans le commit.

## Acceptation

Le harnais lui-même est accepté quand `hex-import` et `hex-ok` tournent et que le score distingue les deux (rappel 1 et zéro inattendu architecture sur `hex-ok`). Chaque phase suivante ajoute ses lignes au tableau et ne se tague pas si son cas est rouge.

Il n'y a pas de version plugin propre à la phase 7. Le harnais voyage dans les tags `0.2.0` et suivants.

## Risques propres

| Risque | Parade |
|---|---|
| Fixtures trop proches des prompts, score sans valeur | Chaque fixture est du code compilable ou syntaxiquement valide, pas une phrase « TODO violation ». `hex-ok` existe pour punir le prompt qui alarme sur tout. |
| Le taux de faux positifs est truqué en n'affichant que 10 findings faciles | On compte les rejets sur ce qui est affiché, et on surveille `REVIEW-DETAIL.md` : si le détail dépasse 30 findings sur une PR de moins de 400 lignes, c'est noté dans `fp-log.md` comme bruit même si l'affichage est plafonné. |
| Jeu d'essai qui contient une vraie faille copiée d'un incident | Interdit. Le SQL planté est un exemple d'école, identifiants fictifs. |

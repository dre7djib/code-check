# Phase 6 — Sécurité deep

Durée : 5 jours. Un run complet sur un pilote, `findings.json` valide, trois rapports générés dans `.review/<nom-du-repo>/runs/`. La commande n'est jamais lancée par `/check` ni par le hook.

## Objectif

Brancher la skill Cloudflare complète, au commit déjà relu, et vérifier les prérequis (Node, sous-agents parallèles, sandbox) avant de chasser. Si le sandbox manque, le run s'arrête après le ledger et la chasse statique, et ne marque rien `confirmed`.

## Prérequis

- Phase 4 : validateur et schéma déjà copiés, tests vendor verts.
- Phase 5 : `/security-deep` refuse les postes dont `securityAccess` n'est pas `deep`.
- Note de cadrage : sandbox présent ou absent. Cette phase ne réouvre pas la décision, elle la teste.
- Le propriétaire vendor relit le delta entre la copie partielle (phase 4) et le commit épinglé. Même SHA de préférence : on complète la copie, on ne prend pas un commit plus récent sans relecture.

## Hors périmètre

- Réécrire les prompts de chasse Cloudflare.
- Lancer le deep sur chaque PR.
- CI centrale. Si le sandbox est absent, la note de cadrage a déjà dit que le deep poste est limité. On ne construit pas la CI dans cette phase.
- Caveman.

## Fichiers

```
skills/security-audit/             # copie complète au SHA vendor-lock, SKILL.md au premier niveau
agents/security/deep.md             # enveloppe : prérequis, dossier, puis la skill
skills/security-deep/SKILL.md
ai.mistral.vibe/agents/security-deep.toml
com.github.copilot/agents/security-deep.agent.md
scripts/check-deep-prereqs.sh
```

`agents/security/fast.md` ne change pas de comportement. `deep.md` ne réutilise pas le chasseur fast comme substitut des six phases.

## Les six phases, telles que la skill les impose

L'enveloppe ne les résume pas à la place de la skill. Elle impose le cadre autour :

1. Reconnaissance → `architecture.md` et `coverage-ledger.json` dans le dossier sécurité. `validate-coverage-ledger.cjs` après création et après chaque mise à jour.
2. Chasse par unités du ledger, agents isolés.
3. Chaque candidat unique part vers un vérificateur neuf.
4. `findings.json`, puis `validate-findings.cjs --target`.
5. Vérification indépendante des enregistrements. Un remplacement matériel relance un vérificateur.
6. `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md` dérivés des enregistrements vérifiés ; `PRIORITIES.md` (P1/P2/P3, liens cliquables) écrit par `finalize-deep.cjs`.

Les rapports restent dans `.review/<nom-du-repo>/runs/`, en `0700`, gitignorés. `architecture.md` et le ledger y restent aussi : ils décrivent la surface d'attaque. Rien de ce dossier n'est copié dans le code applicatif ni dans `REVIEW.md`.

## Tâches

### 1. Compléter la copie

Copier l'arbre manquant du même commit : références de chasse, `validate-coverage-ledger.cjs` et ses tests. `node --test` sur les deux suites vendor. `vendor-lock.md` passe de « copie partielle » à « copie complète », même SHA, date, nom du relecteur.

Contrôle télémétrie : `rg` sur la copie pour `http://`, `https://`, et les hôtes qui ne sont pas des exemples de doc. Une URL d'envoi de données bloque le tag. Les URL d'exemple dans les markdown de chasse sont listées dans la note de relecture, pas supprimées (on ne réécrit pas la skill).

### 2. Script de prérequis

`scripts/check-deep-prereqs.sh` écrit `prereqs.json` dans le dossier sécurité :

```json
{
  "node": "v20.x",
  "validators": "ok",
  "subagents": "assumed",
  "sandbox": "present"
}
```

- `node` absent ou validateurs en échec : code 3, la commande s'arrête avant tout agent.
- `subagents` : la v1 ne détecte pas la capacité mieux que « le modèle en cours sait déléguer ». Le script met `assumed`. L'enveloppe demande au premier appel parallèle (deux agents qui lisent un fichier chacun) de confirmer. Si la délégation échoue, arrêt, `status: failed`, pas de chasse séquentielle déguisée en deep.
- `sandbox` : reprendre le test de la note de cadrage, rejoué par le script (exécution d'une commande `true` ou équivalent dans le bac à sable de l'agent, sans lire le code du pilote). `absent` n'est pas un échec de prérequis. C'est un mode dégradé : la suite a le droit de produire `needs_validation` et `rejected`, et n'a pas le droit de produire `confirmed`. L'enveloppe ajoute cette phrase en tête du prompt de la phase 4 de la skill. Un test sur fixture vérifie qu'avec `sandbox: absent` aucun enregistrement n'a le verdict `confirmed`.

### 3. Enveloppe `deep.md`

Ordre : prérequis, `prepare-security-dir.sh`, puis le corps de la skill en lui donnant le dossier de sortie. Budget `deep` des conventions. À l'échéance : valider ce qui est déjà écrit, marquer le ledger comme incomplet si la skill a un statut pour ça, sinon `status: failed` et conserver les fichiers partiels dans le dossier sécurité. Ne pas relancer.

Le résumé `summary.json` suit le même schéma que le fast, pour que le directeur puisse afficher des compteurs le jour où un humain lance deep puis check. En v1, `/security-deep` affiche les compteurs lui-même. `/check` ne l'appelle pas.

### 4. Run pilote

Un seul pilote, celui dont la note de cadrage autorise l'envoi du code au modèle. Repo complet, pas un diff. Durée notée. `findings.json` passe le validateur avec `--target`. Les trois markdown existent et chaque `quote` est dans le fichier cité (c'est le validateur qui le prouve).

Relire les `confirmed` à la main avant d'en parler à l'équipe : un `confirmed` deep est un vrai signal. S'il n'y en a pas, la phase n'échoue pas. L'acceptation est le run valide, pas un quota de failles.

Conserver hors git, dans le dossier sécurité, le chemin du run. Ne pas coller de finding dans `CHANGELOG.md`. Le changelog dit « deep branché sur le commit X », rien d'autre.

## Acceptation

1. Suites `node --test` des deux validateurs vendor : vert.
2. Prérequis : Node manquant simulé (PATH vide le temps du script) → code 3, dossier de run sécurité absent ou vide, aucun agent lancé.
3. Sandbox absent simulé → le fixture deep ne contient aucun `confirmed`.
4. Un run réel sur un pilote : `findings.json` valide, trois rapports, dossier `.review/<nom-du-repo>/runs/<run-id>` en `0700` et gitignoré, durée sous le budget ou arrêt propre documenté dans `summary.json` (`status: failed` avec les fichiers partiels quand même validés s'ils existent).
5. La commande `check` sur le même repo ne déclenche pas la reconnaissance deep (aucun `coverage-ledger.json` daté de ce check).
6. Sur chaque hôte : soit le run deep aboutit, soit la commande sort 3 avec « deep indisponible sur cet hôte » parce que les sous-agents parallèles ou le sandbox manquent. Un hôte qui simule le deep dans un seul contexte fait échouer la phase.
7. Version `0.6.0`.

## Risques propres

| Risque | Parade |
|---|---|
| Coût d'un deep sans limite | Budget `deep` dans `rules.yml`, arrêt au délai, pas de relance automatique. |
| La copie skill dérive du SHA fast | Un seul SHA dans `vendor-lock.md`. La copie partielle est remplacée par la copie complète, pas superposée. |
| Finding deep commité par erreur | `.review/runs` du repo et `/.review/` du workspace sont gitignorés. La revue de tag vérifie `git status` sans ces fichiers. |

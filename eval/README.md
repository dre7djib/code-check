# eval

Fixtures d'évaluation. Le harnais complet (`score.mjs`, `run-all.sh`) arrive en phase 7 ; la phase 2 pose le premier fixture.

## java-planted

Mini-repo Java, quatre défauts, un par axe (voir `expected/java-planted.json`). Le score compare axe + règle + fichier + ligne (±2 lignes), pas le titre.

```
eval/setup-fixture.sh java-planted /tmp/fx      # dépôt git jetable : main = base, feature = base + changement
cd /tmp/fx && <lancer la commande review sur l'hôte>
```

Attendu : les quatre cas dans `.review/runs/<id>/audit/merged.json`, sans doublon `fichier:ligne`, et un `REVIEW.md` sans les mots « CVE », « secret », « injection ». ArchUnit n'est pas dans ce fixture : le rapport porte « Architecture déterministe non exécutée », l'import interdit vient du reviewer d'architecture.

## Autres fixtures (phase 3)

| Fixture | Attendu |
|---|---|
| `port-not-bloat` | zéro finding `simplicity` : une interface `domain` et son adapter, conformes à `rules.yml` (`expected` = `[]`) |
| `needless-factory` | un finding `simplicity` sur une factory à une seule implémentation, hors couches (`support/`) |
| `missing-test-only` | un seul finding, `axis: tests` ; aucun doublon `simplicity` |

Mesure des tokens : `scripts/measure-tokens.sh <runA> <runB> eval/expected/java-planted.json`. Voir `token-report.md`.

## security-fast (phase 4)

Mini-repo Java dont le diff concatène un paramètre HTTP dans une requête SQL (`ProductSearch.java:17`, appelée par `ProductController`). Attendu (`expected/security-fast.json`) : une entrée `needs_validation` sur ce fichier dans `findings.json`, validateur `validate-security.cjs --target` à 0, jamais `confirmed` (pas de bac à sable), et `scripts/assert-review-has-no-security.sh <REVIEW.md> <findings.json>` à 0.

```
eval/setup-fixture.sh security-fast /tmp/fx && cd /tmp/fx && <lancer review puis security sur l'hôte>
```

Le test `scripts/security-fast.test.cjs` rejoue les scripts de bout en bout avec des réponses d'agents écrites à la main. Il ne prouve pas qu'un modèle détecte le défaut : cela se mesure par un run réel sur chaque hôte.

## check-both (phase 5)

`security-fast` plus un import Spring dans `domain/notify/OrderNotifier.java`. Attendu (`expected/check-both.json`) : un `blocking` d'architecture, un `needs_validation` d'injection, `REVIEW.md` sans la citation SQL, code 1. `scripts/director.test.cjs` rejoue le scénario, le timeout forcé à 1 seconde et les droits d'accès.

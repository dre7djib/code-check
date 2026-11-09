# eval

Fixtures d'évaluation. Le harnais complet (`score.mjs`, `run-all.sh`) arrive en phase 7 ; la phase 2 pose le premier fixture.

## java-planted

Mini-repo Java, quatre défauts, un par axe (voir `expected/java-planted.json`). Le score compare axe + règle + fichier + ligne (±2 lignes), pas le titre.

```
eval/setup-fixture.sh java-planted /tmp/fx      # dépôt git jetable : main = base, feature = base + changement
cd /tmp/fx && <lancer la commande review sur l'hôte>
```

Attendu : les quatre cas dans `.review/runs/<id>/review/merged.json`, sans doublon `fichier:ligne`, et un `REVIEW.md` sans les mots « CVE », « secret », « injection ». ArchUnit n'est pas dans ce fixture : le rapport porte « Architecture déterministe non exécutée », l'import interdit vient du reviewer d'architecture.

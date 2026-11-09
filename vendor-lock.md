# Composants figés

Pas de sous-module qui suit une branche, pas de `npx skills add` au runtime, pas de CLI Caveman (télémétrie) : on copie la skill. Mise à jour = copie des Markdown sur un commit relu, nouvelle ligne du tableau.

| Origine | Commit | Licence | Date | Relecteur |
|---|---|---|---|---|
| `DietrichGebert/ponytail` · `skills/ponytail-review/SKILL.md` → `skills/ponytail/SKILL.md` | `09c434ab73ca43761c5d8b0c5d341926c2fba710` (dernier commit du dossier : `09c434ab…`) | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |
| `JuliusBrussee/caveman` · `skills/caveman/SKILL.md` → `skills/caveman/SKILL.md` | `ef6050c5e1848b6880ff47c32ade1a608a64f85e` | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |
| `cloudflare/security-audit-skill` · `skills/security-audit/{SKILL.md,report-schema.json,VALIDATION-AND-REPORTING.md,validate-findings.cjs,validate-findings.test.cjs,validate-coverage-ledger.cjs,validate-coverage-ledger.test.cjs}` + `LICENSE` → `skills/security-audit/` | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14) | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |

La licence réelle de Caveman est MIT (fichier `LICENSE` du dépôt amont, copié dans `skills/caveman/LICENSE`), pas Apache-2.0 comme l'annonçait le plan. Le texte de licence de chaque composant est copié à côté de sa skill.

## Modifications locales

Frontmatter seulement, corps inchangé (vérifié par `diff`) :

- `name` : `ponytail-review` → `ponytail` (le nom suit le dossier).
- ajout de `user-invocable: false` et `disable-model-invocation: true` sur les deux skills : leurs descriptions se déclenchent sur « review this » et « be brief », et Caveman s'annonce « actif à chaque réponse ». Aucune ne doit se charger hors du plugin. Les agents du plugin lisent le fichier par son chemin.

## Contrôle de copie

- Aucune URL, aucun `curl`, `fetch`, `telemetry` ni `DO_NOT_TRACK` dans les deux fichiers copiés (`grep` vide).
- Ponytail : seule `ponytail-review` est copiée. Les autres skills (`ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`), `hooks/`, `scripts/`, `benchmarks/` : non copiés.
- Caveman : seule `skills/caveman/SKILL.md` est copiée. Exclus : `hooks/`, `tools/`, `mcp-servers/`, `install.sh`, `install.ps1`, `plugins/`, `rules/`, `evals/`, `benchmarks/`, `caveman-compress/` et les skills `caveman-stats`, `caveman-commit`, `caveman-review`, `caveman-help`, `compress`, `cavecrew` (statistiques, scripts, binaires).

## Composants prévus

| Composant | Licence | Phase | État |
|---|---|---|---|
| Ponytail | MIT | 3 | copié |
| Caveman | MIT | 3 | copié |
| Cloudflare security-audit | MIT | 4 | **copie partielle, phase 4** (contrat de sortie et validateurs) ; copie complète (chasse, classes d'attaque, ledger) en phase 6 |

## Cloudflare security-audit : copie partielle, phase 4

- Arborescence du commit épinglé : tout est à plat dans `skills/security-audit/` (pas de `scripts/` ni de `references/`). On garde cette arborescence. Le validateur lit `report-schema.json` à côté de lui.
- Copiés : `SKILL.md`, `report-schema.json`, `VALIDATION-AND-REPORTING.md`, `validate-findings.cjs` et son test, `LICENSE`. Aussi `validate-coverage-ledger.cjs` et son test, non listés par le plan : un test de `validate-findings.test.cjs` (« keeps shared helpers aligned with the coverage-ledger validator ») charge ce module. Sans lui, les tests ne passent pas sans modification.
- `node --test skills/security-audit/*.test.cjs` : 65 tests, passent sans modification. Aucun chemin corrigé.
- Modification locale : frontmatter de `SKILL.md` seulement (`user-invocable: false`, `disable-model-invocation: true`), corps inchangé. Même raison que Ponytail et Caveman : la description se déclenche sur toute question de sécurité.
- Non copiés : `HUNTING.md`, `RECONNAISSANCE.md`, `ATTACK-CLASSES.md` et les guides par classe (phase 6). `SKILL.md` y renvoie ; ces renvois sont sans effet en mode fast.
- Écart avec le plan : `validate-findings.cjs` n'a pas d'option `--target` (un seul argument, le fichier). Le validateur n'est pas modifié. `scripts/validate-security.cjs <findings.json> --target <repo>` le lance tel quel, puis vérifie que chaque fichier et ligne cités existent dans le dépôt cible, que les findings sont triés par fingerprint, et qu'aucun `confirmed` n'est écrit en mode fast.
- Le schéma vendor n'a pas de champ `quote`. La citation du candidat est recopiée dans `evidence[].description` (préfixe `Citation : `), vérifiée contre le fichier avant l'écriture.

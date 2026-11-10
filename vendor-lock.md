# Composants figés

Pas de sous-module qui suit une branche, pas de `npx skills add` au runtime, pas de CLI Caveman (télémétrie) : on copie la skill. Mise à jour = copie des Markdown sur un commit relu, nouvelle ligne du tableau.

| Origine | Commit | Licence | Date | Relecteur |
|---|---|---|---|---|
| `DietrichGebert/ponytail` · `skills/ponytail-review/SKILL.md` → `skills/ponytail/SKILL.md` | `09c434ab73ca43761c5d8b0c5d341926c2fba710` (dernier commit du dossier : `09c434ab…`) | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |
| `JuliusBrussee/caveman` · `skills/caveman/SKILL.md` → `skills/caveman/SKILL.md` | `ef6050c5e1848b6880ff47c32ade1a608a64f85e` | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |
| `cloudflare/security-audit-skill` · `skills/security-audit/{SKILL.md,report-schema.json,VALIDATION-AND-REPORTING.md,validate-findings.cjs,validate-findings.test.cjs,validate-coverage-ledger.cjs,validate-coverage-ledger.test.cjs}` + `LICENSE` → `skills/security-audit/` | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14) | MIT | 2026-11-09 | relu par Claude (assistant) ; signature du propriétaire (équipe de ce dépôt) à apposer |

La licence réelle de Caveman est MIT (fichier `LICENSE` du dépôt amont, copié dans `skills/caveman/LICENSE`), pas Apache-2.0 comme l'annonçait le plan. Le texte de licence de chaque composant est copié à côté de sa skill.

## Modifications locales

Frontmatter seulement pour Ponytail et Caveman, corps inchangé (vérifié par `diff`) :

- `name` : `ponytail-review` → `ponytail` (le nom suit le dossier).
- ajout de `user-invocable: false` et `disable-model-invocation: true` sur les deux skills : leurs descriptions se déclenchent sur « review this » et « be brief », et Caveman s'annonce « actif à chaque réponse ». Aucune ne doit se charger hors du plugin. Les agents du plugin lisent le fichier par son chemin.

Cloudflare security-audit (hors frontmatter de `SKILL.md`) : voir la section « Modifications locales » sous la copie complète phase 6 (ouverture d'entrée Windows).

## Contrôle de copie

- Aucune URL, aucun `curl`, `fetch`, `telemetry` ni `DO_NOT_TRACK` dans les deux fichiers copiés (`grep` vide).
- Ponytail : seule `ponytail-review` est copiée. Les autres skills (`ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`), `hooks/`, `scripts/`, `benchmarks/` : non copiés.
- Caveman : seule `skills/caveman/SKILL.md` est copiée. Exclus : `hooks/`, `tools/`, `mcp-servers/`, `install.sh`, `install.ps1`, `plugins/`, `rules/`, `evals/`, `benchmarks/`, `caveman-compress/` et les skills `caveman-stats`, `caveman-commit`, `caveman-review`, `caveman-help`, `compress`, `cavecrew` (statistiques, scripts, binaires).

## Composants prévus

| Composant | Licence | Phase | État |
|---|---|---|---|
| Ponytail | MIT | 3 | copié |
| Caveman | MIT | 3 | copié |
| Cloudflare security-audit | MIT | 4 | **copie complète, phase 6**, même SHA `c1c8a8c1` que la copie partielle de la phase 4 (remplacée, pas superposée) |

## Cloudflare security-audit : copie complète, phase 6

- Même commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` que la copie partielle (le dernier commit du dossier `skills/security-audit/` de l'amont). Aucun commit plus récent n'est pris : le delta à relire est l'ajout des 11 fichiers de chasse, sans changement des 8 fichiers déjà copiés (`cmp` identique, hors frontmatter de `SKILL.md`).
- Arborescence à plat conservée : `SKILL.md`, `report-schema.json`, `validate-findings.cjs`, `validate-coverage-ledger.cjs` et leurs tests, `RECONNAISSANCE.md`, `HUNTING.md`, `ATTACK-CLASSES.md`, `VALIDATION-AND-REPORTING.md` et les 9 guides par classe (`AI-AND-LLM`, `CLIENT-SIDE`, `CLOUD-AND-DEPLOYMENT`, `DATA-ISOLATION-AND-LIFECYCLE`, `DESKTOP-MOBILE-AND-LOCAL-IPC`, `MEMORY-SAFETY-AND-BINARY`, `PROTOCOLS-RPC-AND-MESSAGING`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY`, `SUPPLY-CHAIN-AND-RELEASE`, `WEB-PROTOCOL-AND-AUTH`), `LICENSE`.
- `node --test skills/security-audit/*.test.cjs` : 65 tests, verts, sans modification.
- Contrôle télémétrie : `grep -E 'https?://'` sur la copie complète (markdown, `.cjs`, `.json`) : aucune occurrence, donc aucune URL d'exemple à lister et aucun point d'envoi de données.
- Modifications locales :
  - frontmatter de `SKILL.md` seulement (`user-invocable: false`, `disable-model-invocation: true`) ;
  - validateurs : ouverture d'entrée Windows via `lstat` + identité `(dev, ino)` (équivalent de [cloudflare/security-audit-skill#145](https://github.com/cloudflare/security-audit-skill/pull/145), encore ouverte à la date du correctif). Sans cela, Node n'expose ni `O_NOFOLLOW` ni `O_NONBLOCK` sous Windows et chaque validation échoue avec « OS no-follow and nonblocking input protection is unavailable ».
- Écart assumé : la skill prévoit un dossier de sortie `~/security-audit-skill/<repo>/run-<N>` ; l'enveloppe `agents/security/deep.md` le remplace par le dossier sécurité du plugin, hors dépôt ou ignoré par git (la skill autorise un dossier dans la cible si git l'ignore). `validate-findings.cjs` est appelé via `scripts/validate-security.cjs --target`.
- Relecteur : relu par Claude (assistant) ; signature du propriétaire à apposer.

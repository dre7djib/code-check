# Sécurité deep : enveloppe de la skill Cloudflare

Rôle : poser le cadre (prérequis, dossier, budget, sandbox, validation), puis suivre la skill `skills/security-audit/SKILL.md` **telle quelle** pour les six phases. Ne pas les résumer à la place de la skill, ne pas réécrire ses prompts de chasse, ne pas réutiliser le chasseur ou le vérificateur de `fast.md` comme substitut.

Le deep n'est lancé que par la commande `security-deep`, jamais par `check`, le hook ou un autre pipeline.

Le répertoire du plugin est le dossier qui contient `agents/`. Droits : lire, chercher, shell des scripts du plugin, déléguer. Écrit uniquement dans le dossier sécurité. Ne modifie jamais le code.

## Ordre

1. **Accès.** `node <plugin>/scripts/check-access.cjs <repo> security-deep` (`security.access: deep` exigé). Code 3 : message, sortir 3, aucun agent.
2. **Prérequis.** `bash <plugin>/scripts/check-deep-prereqs.sh > <tmp>/prereqs.json`. Code 3 : message, sortir 3, **aucun dossier sécurité créé**, aucun agent. Sandbox **présent par défaut**. Pour le bloquer : `CODE_CHECK_SANDBOX=off` (ou `absent` / `false` / `0` / `disabled` / `none` / `block`) → mode dégradé (étape 7).
3. **Cadrage.** Skills `rules-loader` puis `scoping` (`--command security-deep`) : `mode: deep`, `budget` du mode deep. Repo complet, pas le diff.
4. **Dossier.** `bash <plugin>/scripts/prepare-security-dir.sh <run>` → `<run>/security` (`0700`). Déplacer `prereqs.json` dedans. Le dossier doit être sous `.review/runs/` (gitignoré) ; sinon sortir 3.
5. **Parallélisme.** Premier appel parallèle : deux agents `security-deep-research`, chacun lit un fichier (`skills/security-audit/SKILL.md`, `skills/security-audit/report-schema.json`) et le confirme en une ligne. Échec, ou hôte qui ne sait pas déléguer deux contextes : écrire `summary.json` `status: failed` (comptes 0), sortir 3, « deep indisponible sur cet hôte ». Ne jamais faire la chasse séquentiellement dans un seul contexte.
6. **Skill.** Suivre `skills/security-audit/SKILL.md` en mode audit complet, avec : *Output directory* = `<sec>` (pas `~/security-audit-skill/...`), *Target* = le repo, profil `deep`, `run-metadata.json`, `architecture.md` et `coverage-ledger.json` dans `<sec>`. Le validateur du ledger tourne après sa création et après chaque mise à jour ; `validate-findings.cjs` est remplacé par `scripts/validate-security.cjs <sec>/findings.json --target <repo>` (même validateur vendor, plus les contrôles du dépôt). Agents : `security-deep-research` (lecture, chasse, vérification) et `security-deep-general` (exécution locale bornée, seulement si le sandbox est présent).
7. **Sandbox bloqué** (`prereqs.json` → `sandbox: absent`). Ajouter cette phrase en tête du prompt de chaque vérificateur et de l'écriture de `findings.json` : « Sandbox absent : aucun code de la cible n'est exécuté. Verdicts permis : `needs_validation` et `rejected`. Interdit : `confirmed`. » Ne lancer aucun `security-deep-general`. Le run s'arrête après le ledger et la chasse statique. Sinon (défaut) : exécution locale via `security-deep-general` autorisée, `confirmed` permis.
8. **Échéance.** Budget `context.budget.max_minutes` depuis `created_at`. À l'échéance : valider ce qui est écrit, marquer `run_status: "incomplete"` dans `run-metadata.json`, ne pas relancer.
9. **Clôture.** `node <plugin>/scripts/finalize-deep.cjs <sec> --target <repo> --threshold <thresholds.security_confirmed_min_severity>`. Il valide ledger et findings, refuse `confirmed` sans sandbox, écrit `summary.json` (même schéma que le fast) et `exit-code`. Afficher sa sortie : compteurs et chemin du dossier. Aucun titre de finding.

## Interdits

- Lancer le deep depuis `check`, le hook ou une autre commande.
- Chasse ou vérification dans la même conversation que l'orchestrateur ; simuler le deep dans un seul contexte.
- Écrire `confirmed` sans sandbox, éditer `skills/security-audit/`, écrire un schéma de finding parallèle.
- Copier `architecture.md`, le ledger ou un rapport hors du dossier sécurité, dans le code ou dans `REVIEW.md`.
- Commiter quoi que ce soit.

## Code de sortie

Celui de `finalize-deep.cjs` : 0 ; 1 si un `confirmed` atteint le seuil ; 2 échec ou run partiel ; 3 prérequis, accès ou délégation.

## Caveman

Aucun usage.

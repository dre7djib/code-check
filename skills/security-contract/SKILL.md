---
name: security-contract
description: Contrat des findings de sécurité — trois verdicts, schéma Cloudflare vendoré, résumé pour le directeur. Chargé par le chasseur, le vérificateur et l'orchestrateur sécurité.
user-invocable: false
---

# Contrat des findings de sécurité

Le schéma de `findings.json` est `skills/security-audit/report-schema.json` (copie figée Cloudflare, ne pas l'éditer). Un champ refusé se corrige dans notre writer, pas dans le schéma. Pas de schéma parallèle.

| Verdict | Exigence |
|---|---|
| `confirmed` | Autorisé quand le sandbox est **présent** (défaut). Interdit si `CODE_CHECK_SANDBOX=off` (ou équivalent) → `sandbox: absent`. Exige les champs Cloudflare complets (`root_cause`, `execution`, `remediation`, `severity`, …). |
| `needs_validation` | Citation, cause prétendue, bloqueur précis, plan de validation local ou de déploiement. Verdict normal si la preuve locale manque. |
| `rejected` | Le vérificateur a montré que la piste est fausse, avec la raison. Gardé pour ne pas rouvrir la piste au run suivant. |

Interdit d'inventer un quatrième verdict.

Une seed (CVE, secret) ou un indice de la revue devient un candidat, jamais un `confirmed` automatique. Le vérificateur décide.

Le directeur ne reçoit que `summary.json`, au schéma `schemas/security-findings.schema.json` : comptes `confirmed`, `needs_validation`, `rejected`, `cross_hints`, `status` (`ok`, `failed`, `skipped`). Jamais un titre, un fichier ou une citation.

Un finding sécurité n'apparaît jamais dans `REVIEW.md` : `scripts/assert-review-has-no-security.sh` le vérifie.

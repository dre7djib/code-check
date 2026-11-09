---
name: security-deep
description: Commande security-deep. Audit de sécurité complet du dépôt par la skill Cloudflare (six phases, agents isolés parallèles). Jamais lancé par check ni par le hook.
disable-model-invocation: true
---

# security-deep

Le répertoire du plugin est deux niveaux au-dessus de ce fichier. Le repo cible est le répertoire de travail de la session. Suivre `agents/security/deep.md` (lu, pas improvisé), dans cette conversation :

1. `node <plugin>/scripts/check-access.cjs <repo> security-deep` : code 3, afficher le message et sortir.
2. `bash <plugin>/scripts/check-deep-prereqs.sh` : code 3, afficher le message et sortir, sans créer de dossier. `sandbox: absent` : mode dégradé, jamais de `confirmed`.
3. Cadrage (`rules-loader`, `scoping --command security-deep`), dossier (`prepare-security-dir.sh`), confirmation du parallélisme (deux agents `security-deep-research`). Pas de parallélisme : « deep indisponible sur cet hôte », code 3.
4. Suivre `skills/security-audit/SKILL.md` en audit complet vers le dossier sécurité, puis `finalize-deep.cjs`.
5. Afficher compteurs et chemin du dossier, jamais un titre.

## Interdits

- Faire la chasse dans un seul contexte, ou la déguiser en deep avec les agents fast.
- Écrire `confirmed` sans sandbox présent.
- Lancer depuis `check` ou un hook.
- Modifier le code du repo.

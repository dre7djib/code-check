#!/usr/bin/env bash
# Prérequis du mode deep. Écrit prereqs.json sur stdout ; rien sur disque.
# usage: check-deep-prereqs.sh
# Code 3 : Node absent (ou < 18) ou validateurs Cloudflare en échec ; message sur stderr, aucun JSON.
# sandbox : CODE_CHECK_SANDBOX est un préfixe de commande qui enveloppe l'exécution du code de la cible
#   (macOS : sandbox-exec -p '(version 1)(allow default)(deny network*)' ; Linux : bwrap --unshare-net ...).
#   present = `$CODE_CHECK_SANDBOX true` réussit ET une connexion sortante y est refusée. Sinon absent
#   (mode dégradé : needs_validation et rejected seulement, jamais confirmed). Ce test ne prouve pas
#   les autres contrôles de la skill (environnement vide, cible en lecture seule, limites) : ils
#   restent à la charge du préfixe choisi.
# subagents : la v1 ne détecte pas la capacité ; `assumed`, confirmé par l'enveloppe au premier appel parallèle.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$HERE/../skills/security-audit"

command -v node >/dev/null 2>&1 || { echo "node introuvable : deep impossible" >&2; exit 3; }
NODE_V="$(node -v)"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || { echo "Node $NODE_V < 18 : deep impossible" >&2; exit 3; }

if ! node --test "$SKILL"/validate-findings.test.cjs "$SKILL"/validate-coverage-ledger.test.cjs >/dev/null 2>&1; then
  echo "validateurs Cloudflare en échec (node --test) : deep impossible" >&2; exit 3
fi

SANDBOX=absent
if [ -n "${CODE_CHECK_SANDBOX:-}" ]; then
  # shellcheck disable=SC2086
  if eval "$CODE_CHECK_SANDBOX true" >/dev/null 2>&1; then
    # une connexion sortante doit être refusée dans le bac à sable
    if eval "$CODE_CHECK_SANDBOX node -e 'const s=require(\"net\").connect({host:\"1.1.1.1\",port:443,timeout:2000});s.on(\"connect\",()=>process.exit(1));s.on(\"error\",()=>process.exit(0));s.on(\"timeout\",()=>process.exit(0))'" >/dev/null 2>&1; then
      SANDBOX=present
    fi
  fi
fi

printf '{\n  "node": "%s",\n  "validators": "ok",\n  "subagents": "assumed",\n  "sandbox": "%s"\n}\n' "$NODE_V" "$SANDBOX"

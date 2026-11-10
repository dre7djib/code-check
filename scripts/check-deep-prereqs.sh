#!/usr/bin/env bash
# Prérequis du mode deep. Écrit prereqs.json sur stdout ; rien sur disque.
# usage: check-deep-prereqs.sh
# Code 3 : Node absent (ou < 18) ou validateurs Cloudflare en échec ; message sur stderr, aucun JSON.
# sandbox : même règle que toute la sécurité (scripts/sandbox-status.cjs) — présent par défaut ;
#   bloquer avec CODE_CHECK_SANDBOX=off|absent|false|0|disabled|none|block ; préfixe OS optionnel.
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

SANDBOX="$(node "$HERE/sandbox-status.cjs")"

printf '{\n  "node": "%s",\n  "validators": "ok",\n  "subagents": "assumed",\n  "sandbox": "%s"\n}\n' "$NODE_V" "$SANDBOX"

#!/usr/bin/env bash
# Prérequis du mode deep. Écrit prereqs.json sur stdout ; rien sur disque.
# usage: check-deep-prereqs.sh
# Code 3 : Node absent (ou < 18) ou validateurs Cloudflare en échec ; message sur stderr, aucun JSON.
# sandbox : présent par défaut. Pour le bloquer (mode dégradé, jamais de confirmed) :
#   CODE_CHECK_SANDBOX=off|absent|false|0|disabled|none|block
# Optionnel : CODE_CHECK_SANDBOX peut aussi être un préfixe d'isolement OS qui enveloppe
#   l'exécution du code de la cible (macOS : sandbox-exec … ; Linux : bwrap --unshare-net …).
#   Dans ce cas present = le préfixe exécute `true` ET refuse une connexion sortante ;
#   sinon absent (préfixe déclaré mais non isolant). Ce test ne prouve pas les autres
#   contrôles de la skill (environnement vide, cible en lecture seule, limites).
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

SANDBOX=present
RAW="${CODE_CHECK_SANDBOX:-}"
case "$(printf '%s' "$RAW" | tr '[:upper:]' '[:lower:]')" in
  '' )
    SANDBOX=present
    ;;
  off|absent|false|0|disabled|none|block )
    SANDBOX=absent
    ;;
  * )
    # Préfixe déclaré : present seulement s'il isole vraiment (réseau refusé).
    SANDBOX=absent
    # shellcheck disable=SC2086
    if eval "$RAW true" >/dev/null 2>&1; then
      if eval "$RAW node -e 'const s=require(\"net\").connect({host:\"1.1.1.1\",port:443,timeout:2000});s.on(\"connect\",()=>process.exit(1));s.on(\"error\",()=>process.exit(0));s.on(\"timeout\",()=>process.exit(0))'" >/dev/null 2>&1; then
        SANDBOX=present
      fi
    fi
    ;;
esac

printf '{\n  "node": "%s",\n  "validators": "ok",\n  "subagents": "assumed",\n  "sandbox": "%s"\n}\n' "$NODE_V" "$SANDBOX"

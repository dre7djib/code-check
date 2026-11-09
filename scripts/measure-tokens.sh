#!/usr/bin/env bash
# Mesure A/B des prompts de règles. Aucun accès réseau. usage: measure-tokens.sh <runA> <runB> <expected.json> [--host h] [--out f]
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/measure-tokens.cjs" "$@"

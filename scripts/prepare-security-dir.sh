#!/usr/bin/env bash
# Crée <run>/security en 0700 et écrit son chemin dans <run>/security-dir.path.
# Le run de revue (cadrage) doit déjà exister : <repo>/.review/runs/<run-id>/.
# Layout unifié :
#   <repo>/.review/runs/<run-id>/audit/      # revue de code
#   <repo>/.review/runs/<run-id>/security/   # sécurité fast / deep
# usage: prepare-security-dir.sh <run-de-revue>
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: prepare-security-dir.sh <run-de-revue>" >&2; exit 3; }
RUN="$(cd "$1" && pwd)" || { echo "run introuvable : $1" >&2; exit 3; }
[ -f "$RUN/context.json" ] || { echo "context.json manquant dans $RUN" >&2; exit 3; }
umask 077
DIR="$RUN/security"
mkdir -p "$DIR"
chmod 700 "$DIR"
printf '%s\n' "$DIR" > "$RUN/security-dir.path"
printf '%s\n' "$DIR"

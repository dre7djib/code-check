#!/usr/bin/env bash
# Crée <workspace>/.review/<nom-du-repo>/runs/<run-id> en 0700 et écrit son chemin dans
# <run de revue>/security-dir.path (un chemin, jamais un finding).
# usage: prepare-security-dir.sh <nom-du-repo> <run-id> [<run-de-revue>]
# Workspace : CODE_CHECK_WORKSPACE, sinon la racine git du répertoire courant.
# CODE_CHECK_SECURITY_DIR remplace <workspace>/.review. Deux dépôts du même nom (chemins
# différents) : le second prend le suffixe -<12 hex du SHA-256 de son chemin>.
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: prepare-security-dir.sh <nom-du-repo> <run-id> [<run-de-revue>]" >&2; exit 3; }
NAME="$1"; RUN_ID="$2"; REVIEW_RUN="${3:-}"
case "$NAME$RUN_ID" in */*|*..*|"") echo "nom ou run-id invalide" >&2; exit 3;; esac
REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "hors dépôt git" >&2; exit 3; }
WS="${CODE_CHECK_WORKSPACE:-$REPO}"
BASE="${CODE_CHECK_SECURITY_DIR:-$WS/.review}"
umask 077
mkdir -p "$BASE"
if [ -f "$BASE/$NAME/.repo-path" ] && [ "$(cat "$BASE/$NAME/.repo-path")" != "$REPO" ]; then
  SUM="$(printf '%s' "$REPO" | shasum -a 256 | cut -c1-12)"
  NAME="$NAME-$SUM"
fi
mkdir -p "$BASE/$NAME/runs/$RUN_ID"
printf '%s' "$REPO" > "$BASE/$NAME/.repo-path"
chmod 700 "$BASE/$NAME" "$BASE/$NAME/runs" "$BASE/$NAME/runs/$RUN_ID"
DIR="$BASE/$NAME/runs/$RUN_ID"
[ -z "$REVIEW_RUN" ] || printf '%s\n' "$DIR" > "$REVIEW_RUN/security-dir.path"
printf '%s\n' "$DIR"

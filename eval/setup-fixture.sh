#!/usr/bin/env bash
# Crée un dépôt git jetable depuis un fixture : base/ sur main, change/ sur la branche feature.
# usage: setup-fixture.sh <fixture> <destination-vide>
set -euo pipefail
FX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fixtures/$1"; DEST="$2"
[ -d "$FX/base" ] || { echo "fixture introuvable : $1" >&2; exit 3; }
[ -z "$(ls -A "$DEST" 2>/dev/null)" ] || { echo "destination non vide" >&2; exit 3; }
mkdir -p "$DEST"; cp -R "$FX/base/." "$DEST/"
cd "$DEST"
git init -q -b main
printf '/.review/runs/\n' > .gitignore
git add -A; git -c user.email=eval@local -c user.name=eval commit -qm base
git checkout -q -b feature
cp -R "$FX/change/." .
git add -A; git -c user.email=eval@local -c user.name=eval commit -qm change
echo "$DEST"

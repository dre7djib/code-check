#!/usr/bin/env bash
# Checks déterministes. usage: run-deterministic.sh <context.json> <out-dir>
# Sortie 0 si le script a fini (même avec des outils rouges), 3 si context.json illisible,
# 1 si erreur interne. Un outil absent est un skip noté dans raw/skipped.txt.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTX="${1:-}"; OUT="${2:-}"
[ -n "$CTX" ] && [ -n "$OUT" ] || { echo "usage: run-deterministic.sh <context.json> <out-dir>" >&2; exit 1; }
[ -r "$CTX" ] || { echo "context.json illisible" >&2; exit 3; }

REPO="$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(c.repo.path)' "$CTX")" || { echo "context.json illisible" >&2; exit 3; }
STACK="$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write((c.stack||[]).join(" "))' "$CTX")" || exit 3

RAW="$OUT/raw"
mkdir -p "$RAW"
: > "$RAW/skipped.txt"
skip() { echo "$1" >> "$RAW/skipped.txt"; }
has_stack() { case " $STACK " in *" $1 "*) return 0;; *) return 1;; esac; }

if [ -z "$STACK" ]; then
  skip "stack inconnue : aucun check"
else
  if has_stack java; then
    if find "$REPO/src/test" -name '*Architecture*.java' 2>/dev/null | grep -q .; then
      if [ -f "$REPO/pom.xml" ] && command -v mvn >/dev/null 2>&1; then
        (cd "$REPO" && mvn -q -DskipITs test -Dtest='*Architecture*' -Dsurefire.failIfNoSpecifiedTests=false) > "$RAW/archunit.txt" 2>&1 || true
      elif [ -x "$REPO/gradlew" ]; then
        (cd "$REPO" && ./gradlew test --tests '*Architecture*') > "$RAW/archunit.txt" 2>&1 || true
      else
        skip "architecture déterministe non exécutée : Maven/Gradle introuvable"
      fi
    else
      skip "architecture déterministe non exécutée : aucun test ArchUnit"
    fi
  fi
  if has_stack node; then
    DC_CONF=""
    for f in .dependency-cruiser.cjs .dependency-cruiser.js .dependency-cruiser.json .review/dependency-cruiser.cjs .review/dependency-cruiser.js .review/dependency-cruiser.json; do
      [ -f "$REPO/$f" ] && { DC_CONF="$f"; break; }
    done
    if ! grep -q '"dependency-cruiser"' "$REPO/package.json" 2>/dev/null; then
      skip "architecture déterministe non exécutée : dependency-cruiser absent des devDependencies"
    elif [ -z "$DC_CONF" ]; then
      skip "architecture déterministe non exécutée : pas de config dependency-cruiser"
    elif [ ! -x "$REPO/node_modules/.bin/depcruise" ]; then
      skip "architecture déterministe non exécutée : dependency-cruiser non installé (npm install)"
    else
      SRC=src; [ -d "$REPO/src" ] || SRC=.
      (cd "$REPO" && node_modules/.bin/depcruise "$SRC" --config "$DC_CONF" --output-type json) > "$RAW/depcruise.json" 2> "$RAW/depcruise.err" || true
    fi
    if [ -f "$REPO/package-lock.json" ] && command -v npm >/dev/null 2>&1; then
      (cd "$REPO" && npm audit --json --offline=false) > "$RAW/npm-audit.json" 2>/dev/null || true
    fi
    if grep -q '"lint"' "$REPO/package.json" 2>/dev/null; then
      (cd "$REPO" && npm run --silent lint) > "$RAW/lint.txt" 2>&1 || true
    else
      skip "linter non exécuté : pas de cible lint"
    fi
  fi
fi

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks stdin --report-format json --report-path "$RAW/gitleaks.json" --no-banner < "$(dirname "$CTX")/diff.patch" > "$RAW/gitleaks.txt" 2>&1 || true
else
  skip "gitleaks absent"
fi

node "$HERE/parse-deterministic.cjs" "$CTX" "$OUT"

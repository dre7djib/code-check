#!/usr/bin/env bash
# Échoue si le directeur a vu un finding sécurité : titre ou citation de findings.json présent dans
# les fichiers qu'il a manipulés (director/trace/, summary.txt, ses messages archivés).
# usage: assert-director-blind.sh <findings.json> <fichier-ou-dossier>...
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: assert-director-blind.sh <findings.json> <chemin>..." >&2; exit 3; }
exec node - "$@" <<'JS'
const fs = require('fs'), path = require('path');
const [fj, ...roots] = process.argv.slice(2);
const files = [];
const walk = (p) => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e)); else files.push(p); };
roots.forEach(walk);
const needles = [];
for (const f of JSON.parse(fs.readFileSync(fj, 'utf8'))) {
  needles.push(f.title);
  for (const e of f.evidence || []) needles.push((e.description || '').replace(/^Citation : /, '').trim());
}
const bad = [];
for (const file of files) {
  const t = fs.readFileSync(file, 'utf8');
  for (const n of needles) if (n && n.length >= 4 && t.includes(n)) bad.push(`${file} : ${n}`);
}
if (bad.length) { console.error('directeur non aveugle :\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`ok : ${files.length} fichiers sans titre ni citation de finding`);
JS

#!/usr/bin/env bash
# Échoue si REVIEW.md (ou tout markdown de revue passé) laisse fuir un finding sécurité :
# titre, citation, ou file:ligne, ou un mot de sécurité interdit. Les chemins seuls ne comptent pas.
# usage: assert-review-has-no-security.sh <REVIEW.md> <findings.json>
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: assert-review-has-no-security.sh <REVIEW.md> <findings.json>" >&2; exit 3; }
exec node - "$1" "$2" <<'JS'
const fs = require('fs');
const [md, fj] = process.argv.slice(2);
const text = fs.readFileSync(md, 'utf8');
const low = text.toLowerCase();
const findings = JSON.parse(fs.readFileSync(fj, 'utf8'));
const bad = [];
for (const f of findings) {
  if (f.title && low.includes(f.title.toLowerCase())) bad.push(`titre : ${f.title}`);
  for (const e of f.evidence || []) {
    const q = (e.description || '').replace(/^Citation : /, '').trim();
    if (q.length >= 4 && text.includes(q)) bad.push(`citation : ${q}`);
    if (text.includes(`${e.file}:${e.line}`)) bad.push(`position : ${e.file}:${e.line}`);
  }
}
for (const w of ['sql', 'cve', 'injection', 'secret']) if (new RegExp(`\\b${w}`, 'i').test(text)) bad.push(`mot interdit : ${w}`);
if (bad.length) { console.error('fuite sécurité dans ' + md + ' :\n  ' + [...new Set(bad)].join('\n  ')); process.exit(1); }
console.log('ok : aucune fuite sécurité dans ' + md);
JS

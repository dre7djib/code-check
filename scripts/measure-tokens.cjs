#!/usr/bin/env node
'use strict';
// Compare deux runs (A : règles intégrales, B : règles compactes). Aucun réseau.
// usage: measure-tokens.cjs <runA> <runB> <expected.json> [--host h] [--out report.md]
// Tokens = caractères / 4 (estimation). Un attendu absent de B est un échec.
const fs = require('node:fs');
const path = require('node:path');

const a = process.argv.slice(2);
const pos = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')));
const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const [runA, runB, expectedPath] = pos.map((p) => path.resolve(p));
if (!runA || !runB || !expectedPath) { console.error('usage: measure-tokens.cjs <runA> <runB> <expected.json> [--host h] [--out f]'); process.exit(3); }

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
function chars(run) {
  const dir = path.join(run, 'audit', 'trace');
  const meta = rd(path.join(dir, 'meta.json'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.prompt.md'));
  return { files: files.length, total: files.reduce((n, f) => n + fs.readFileSync(path.join(dir, f), 'utf8').length, 0), rules: meta.rules_chars, mode: meta.rules };
}
const expected = rd(expectedPath);
const matches = (e, f) => f.axis === e.axis && f.file === e.file && Math.abs(f.line - e.line) <= 2;
function lost(run) { const m = rd(path.join(run, 'audit', 'merged.json')); return expected.filter((e) => !m.some((f) => matches(e, f))); }

const A = chars(runA), B = chars(runB);
const lostA = lost(runA), lostB = lost(runB);
const ratio = B.total / A.total;
const rulesRatio = B.rules / A.rules;
const host = opt('--host') || rd(path.join(runA, 'context.json')).host;
const ok = B.total < A.total && lostB.length === 0;
const report = [
  `## Hôte ${host}`,
  '',
  '| | Run A (règles intégrales) | Run B (règles compactes) |',
  '|---|---|---|',
  `| Caractères, prompts reviewers (${A.files} axes) | ${A.total} | ${B.total} |`,
  `| dont règles | ${A.rules} | ${B.rules} |`,
  `| Tokens estimés (caractères / 4) | ${Math.round(A.total / 4)} | ${Math.round(B.total / 4)} |`,
  `| Findings attendus perdus | ${lostA.length} | ${lostB.length} |`,
  '',
  `Ratio B / A : ${ratio.toFixed(2)} sur le prompt complet, ${rulesRatio.toFixed(2)} sur le bloc de règles. Les tokens sont une estimation, pas un usage mesuré par l'hôte.`,
  lostB.length ? `Perdus en B : ${lostB.map((e) => `${e.axis} ${e.file}:${e.line}`).join(', ')}.` : 'Aucun finding attendu perdu en B.',
  `Verdict : ${ok ? 'acceptable' : 'échec'}.`,
  ''
].join('\n');
if (opt('--out')) fs.appendFileSync(path.resolve(opt('--out')), '\n' + report);
process.stdout.write(report);
process.exit(ok ? 0 : 1);

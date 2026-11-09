'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'build-report.cjs');
const f = (o) => ({ id: 'x:a', axis: 'architecture', severity: 'fix', file: 'a/B.java', line: 3, title: 'Titre.', evidence: 'code', rule: 'r', source: 'agent', ...o });

function run(det, agents, axes = ['architecture', 'naming'], rules) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-r-'));
  fs.mkdirSync(path.join(d, 'repo', '.review'), { recursive: true });
  if (rules) fs.writeFileSync(path.join(d, 'repo', '.review', 'rules.yml'), rules);
  fs.mkdirSync(path.join(d, 'deterministic'));
  fs.mkdirSync(path.join(d, 'review', 'findings'), { recursive: true });
  fs.writeFileSync(path.join(d, 'context.json'), JSON.stringify({ run_id: 'r', mode: 'fast', host: 'claude', rules_sha256: 'a'.repeat(64), axes, repo: { path: path.join(d, 'repo') } }));
  fs.writeFileSync(path.join(d, 'deterministic', 'review-findings.json'), JSON.stringify(det));
  for (const [axis, list] of Object.entries(agents)) fs.writeFileSync(path.join(d, 'review', 'findings', `${axis}.json`), JSON.stringify(list));
  const r = spawnSync('node', [script, d], { encoding: 'utf8' });
  const read = (p) => fs.readFileSync(path.join(d, p), 'utf8');
  return { r, d, merged: JSON.parse(read('review/merged.json')), review: read('review/REVIEW.md'), cross: JSON.parse(read('cross-hints.json')) };
}

test('même file:line : une entrée, sévérité la plus haute, autres axes notés', () => {
  const x = run([f({ id: 'archunit:a', severity: 'blocking', source: 'archunit' })], { architecture: [], naming: [f({ id: 'naming:a', axis: 'naming', severity: 'fix' })] });
  assert.strictEqual(x.merged.length, 1);
  assert.strictEqual(x.merged[0].severity, 'blocking');
  assert.strictEqual(x.merged[0].source, 'archunit');
  assert.deepStrictEqual(x.merged[0].also_flagged_by, ['naming']);
  assert.strictEqual(x.r.status, 1);
});
test('finding déterministe repris tel quel', () => {
  const d = f({ id: 'archunit:b', severity: 'blocking', source: 'archunit', line: 7 });
  const x = run([d], { architecture: [], naming: [] });
  assert.deepStrictEqual(x.merged[0], d);
});
test('invalide = écart schéma ; mauvais axe = hors axe ; route security = cross-hints', () => {
  const x = run([], {
    architecture: [{ nope: 1 }, f({ id: 'x:b', axis: 'naming', line: 4 }), f({ id: 'x:c', line: 5, route: 'security', title: 'Indice.' })],
    naming: []
  });
  assert.strictEqual(x.merged.length, 0);
  assert.strictEqual(x.cross.length, 1);
  assert.match(x.r.stdout, /Écarts schéma\s+→ 1/);
  assert.match(x.r.stdout, /Hors axe\s+→ 1/);
  assert.ok(!x.review.includes('Indice.'));
  assert.match(x.review, /transmis au rapport sécurité/);
  assert.ok(!/\d.*transmis/.test(x.review));
});
test('axe manquant : mentionné, code 2 sans bloquant', () => {
  const x = run([], { architecture: [] });
  assert.match(x.review, /Axes non exécutés : naming/);
  assert.strictEqual(x.r.status, 2);
});
test('zéro finding : « Aucun point. » seul', () => {
  const x = run([], { architecture: [], naming: [] });
  assert.strictEqual(x.review, 'Aucun point.\n');
  assert.strictEqual(x.r.status, 0);
});
test('plafond display.review_max_findings', () => {
  const list = [1, 2, 3].map((n) => f({ id: `x:n${n}`, line: n }));
  const x = run(list, { architecture: [], naming: [] }, ['architecture', 'naming'], 'display:\n  review_max_findings: 2\n');
  assert.match(x.review, /2 findings affichés sur 3/);
  assert.strictEqual(x.merged.length, 3);
});

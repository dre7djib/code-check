'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { renderPriorities, writePriorities, priorityOf, locLink } = require('./build-priorities.cjs');

const SQL = 'src/main/java/com/acme/shop/adapters/persistence/ProductSearch.java';

const confirmed = (sev, fp = `deep-${sev}`) => ({
  verdict: 'confirmed', fingerprint: fp, title: `Faille ${sev}`, description: 'd',
  root_cause: 'c', intended_behavior: 'i',
  trace: [{ kind: 'sink', file: SQL, line: 17, scope: 's', description: 'd' }],
  evidence: [{ file: SQL, line: 17, description: 'preuve' }],
  conditions: [], execution: { attacker_perspective: 'a', payloads: ['x'], instructions: ['y'], observed_result: 'z' },
  remediation: { strategy: 'fix' },
  severity: { likelihood: { score: sev, reason: 'r' }, impact: { score: sev, reason: 'r' }, overall_severity: sev },
  confidence: { score: 'high', reason: 'r' }
});

const needs = (fp, title = 'Piste') => ({
  verdict: 'needs_validation', fingerprint: fp, title, description: 'd',
  claimed_root_cause: 'c',
  trace: [{ kind: 'sink', file: SQL, line: 17, scope: 's', description: 'd' }],
  evidence: [{ file: SQL, line: 17, description: 'preuve' }],
  blockers: ['Pas de bac à sable.'],
  validation_plan: { local: 'Rejouer.' }
});

test('priorityOf : confirmed mappe critical/high→P1, medium→P2, low→P3', () => {
  assert.strictEqual(priorityOf(confirmed('critical')), 'P1');
  assert.strictEqual(priorityOf(confirmed('high')), 'P1');
  assert.strictEqual(priorityOf(confirmed('medium')), 'P2');
  assert.strictEqual(priorityOf(confirmed('low')), 'P3');
  assert.strictEqual(priorityOf(confirmed('informational')), 'P3');
});

test('priorityOf : needs_validation provisoire selon kind du fingerprint fast', () => {
  assert.strictEqual(priorityOf(needs('fast-injection-abc')), 'P1');
  assert.strictEqual(priorityOf(needs('fast-secret-abc')), 'P1');
  assert.strictEqual(priorityOf(needs('fast-access-control-abc')), 'P1');
  assert.strictEqual(priorityOf(needs('fast-deserialization-abc')), 'P1');
  assert.strictEqual(priorityOf(needs('fast-cve-abc')), 'P2');
  assert.strictEqual(priorityOf(needs('fast-other-abc')), 'P3');
  assert.strictEqual(priorityOf(needs('deep-opaque-id')), 'P2');
});

test('priorityOf : rejected exclu', () => {
  assert.strictEqual(priorityOf({ verdict: 'rejected' }), null);
});

test('locLink : chemin relatif + ancre #L', () => {
  const sec = '/tmp/repo/.review/runs/r1/security';
  const repo = '/tmp/repo';
  // security → r1 → runs → .review → repo = ../../../../src/…
  assert.strictEqual(
    locLink(sec, repo, 'src/A.java', 42),
    '[src/A.java:42](../../../../src/A.java#L42)'
  );
});

test('renderPriorities : sections P1/P2/P3 et lien cliquable', () => {
  const sec = path.join(os.tmpdir(), 'cc-prio-sec');
  const repo = path.join(os.tmpdir(), 'cc-prio-repo');
  const md = renderPriorities([
    confirmed('high', 'deep-high-1'),
    confirmed('medium', 'deep-med-1'),
    confirmed('low', 'deep-low-1'),
    needs('fast-injection-deadbeef', 'SQL concaténée'),
    { verdict: 'rejected', fingerprint: 'r1', title: 'Non', description: 'd', claimed_root_cause: 'c',
      trace: [{ kind: 'sink', file: SQL, line: 17, scope: 's', description: 'd' }],
      evidence: [{ file: SQL, line: 17, description: 'p' }], reason: 'faux positif' }
  ], sec, repo);
  assert.match(md, /## P1 — Critique/);
  assert.match(md, /## P2 — Important/);
  assert.match(md, /## P3 — Modéré/);
  assert.match(md, /Faille high/);
  assert.match(md, /Faille medium/);
  assert.match(md, /Faille low/);
  assert.match(md, /SQL concaténée/);
  assert.doesNotMatch(md, /faux positif|\bNon\b/);
  assert.match(md, new RegExp(`\\[${SQL.replace(/\./g, '\\.')}:17\\]\\([^)]+#L17\\)`));
});

test('writePriorities + CLI écrivent PRIORITIES.md', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-prio-'));
  const sec = path.join(d, 'security');
  const repo = path.join(d, 'repo');
  fs.mkdirSync(sec);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'x\n');
  const findings = [needs('fast-injection-aabbcc', 'Injection')];
  findings[0].evidence[0] = { file: 'src/a.js', line: 1, description: 'x' };
  findings[0].trace[0] = { kind: 'sink', file: 'src/a.js', line: 1, scope: 's', description: 'd' };
  fs.writeFileSync(path.join(sec, 'findings.json'), JSON.stringify(findings));
  writePriorities(sec, repo, findings);
  const md = fs.readFileSync(path.join(sec, 'PRIORITIES.md'), 'utf8');
  assert.match(md, /\[src\/a\.js:1\]\(\.\.\/repo\/src\/a\.js#L1\)/);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'build-priorities.cjs'), sec, '--target', repo], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /PRIORITIES\.md/);
});

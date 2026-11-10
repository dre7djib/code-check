'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...o, env: { ...process.env, CODE_CHECK_HOST: 'claude', ...(o.env || {}) } });
const js = (script, args, o = {}) => sh('node', [path.join(__dirname, script), ...args], o);
const BASH = sh('which', ['bash']).stdout.trim();
const PRE = path.join(__dirname, 'check-deep-prereqs.sh');
const SQL = 'src/main/java/com/acme/shop/adapters/persistence/ProductSearch.java';

const confirmed = (fp) => ({
  verdict: 'confirmed', fingerprint: fp, title: 'Injection dans la recherche produit', description: 'Le paramètre est concaténé.',
  root_cause: 'Concaténation dans la requête.', intended_behavior: 'La requête doit être paramétrée.',
  trace: [{ kind: 'sink', file: SQL, line: 17, scope: 'ProductSearch.byName', description: 'Exécution de la requête.' }],
  evidence: [{ file: SQL, line: 17, description: 'Citation : concaténation dans executeQuery' }],
  conditions: [], execution: { attacker_perspective: 'Utilisateur anonyme.', payloads: ["x' OR '1'='1"], instructions: ['Appeler find avec le payload.'], observed_result: 'Toutes les lignes sont renvoyées.' },
  remediation: { strategy: 'Utiliser un PreparedStatement.' },
  severity: { likelihood: { score: 'high', reason: 'Entrée directe.' }, impact: { score: 'high', reason: 'Lecture de la table.' }, overall_severity: 'high' },
  confidence: { score: 'high', reason: 'Rejoué.' }
});

function secDir(findings, sandbox, extra = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-deep-'));
  const repo = path.join(d, 'shop');
  assert.strictEqual(sh('bash', [path.join(root, 'eval', 'setup-fixture.sh'), 'security-fast', repo]).status, 0);
  const sec = path.join(d, 'sec');
  fs.mkdirSync(sec);
  fs.writeFileSync(path.join(sec, 'findings.json'), JSON.stringify(findings));
  fs.writeFileSync(path.join(sec, 'coverage-ledger.json'), '[]');
  fs.writeFileSync(path.join(sec, 'prereqs.json'), JSON.stringify({ node: process.version, validators: 'ok', subagents: 'assumed', sandbox }));
  for (const f of ['REPORT.md', 'FINDINGS-DETAIL.md', 'NEEDS-VALIDATION.md']) fs.writeFileSync(path.join(sec, f), '# x\n');
  if (extra.meta) fs.writeFileSync(path.join(sec, 'run-metadata.json'), JSON.stringify(extra.meta));
  return { repo, sec };
}
const fin = (s, args = []) => js('finalize-deep.cjs', [s.sec, '--target', s.repo, ...args]);
const summary = (s) => JSON.parse(fs.readFileSync(path.join(s.sec, 'summary.json'), 'utf8'));

test('prérequis : Node absent -> code 3, aucun JSON, rien écrit', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-nopath-'));
  const r = sh(BASH, [PRE], { env: { PATH: empty } });
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /node introuvable/);
  assert.strictEqual(r.stdout, '');
});

test('prérequis : validateurs OK, sandbox present par défaut, JSON conforme', () => {
  const r = sh('bash', [PRE], { env: { CODE_CHECK_SANDBOX: '' } });
  assert.strictEqual(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepStrictEqual(Object.keys(j), ['node', 'validators', 'subagents', 'sandbox']);
  assert.strictEqual(j.sandbox, 'present');
  assert.strictEqual(j.subagents, 'assumed');
});

test('prérequis : CODE_CHECK_SANDBOX=off bloque le sandbox', () => {
  for (const v of ['off', 'absent', 'false', '0', 'disabled', 'none', 'block', 'OFF']) {
    const r = sh('bash', [PRE], { env: { CODE_CHECK_SANDBOX: v } });
    assert.strictEqual(JSON.parse(r.stdout).sandbox, 'absent', v);
  }
});

test('prérequis : un préfixe qui laisse le réseau ouvert n’est pas un sandbox', () => {
  const r = sh('bash', [PRE], { env: { CODE_CHECK_SANDBOX: 'env' } });
  assert.strictEqual(JSON.parse(r.stdout).sandbox, 'absent');
});

test('prérequis : sandbox-exec sans réseau -> present (macOS seulement)', { skip: process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sandbox-exec') }, () => {
  const r = sh('bash', [PRE], { env: { CODE_CHECK_SANDBOX: "sandbox-exec -p '(version 1)(allow default)(deny network*)'" } });
  assert.strictEqual(JSON.parse(r.stdout).sandbox, 'present');
});

test('finalize : prereqs manquant = sandbox present (confirmed accepté)', () => {
  const s = secDir([confirmed('deep-injection-default')], 'present');
  fs.rmSync(path.join(s.sec, 'prereqs.json'));
  const r = fin(s, ['--threshold', 'high']);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.strictEqual(summary(s).confirmed, 1);
  assert.strictEqual(summary(s).status, 'ok');
});

test('sandbox absent : un confirmed est refusé, status failed, code 2', () => {
  const s = secDir([confirmed('deep-injection-1')], 'absent');
  const r = fin(s);
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.strictEqual(summary(s).status, 'failed');
  assert.match(fs.readFileSync(path.join(s.sec, 'failure.txt'), 'utf8'), /confirmed interdit/);
  assert.ok(!fs.existsSync(path.join(s.sec, 'PRIORITIES.md')));
});

test('sandbox present : confirmed accepté ; au seuil -> code 1', () => {
  const s = secDir([confirmed('deep-injection-1')], 'present');
  const r = fin(s, ['--threshold', 'high']);
  assert.strictEqual(r.status, 1, r.stderr);
  assert.strictEqual(summary(s).confirmed, 1);
  assert.strictEqual(summary(s).status, 'ok');
  const prio = fs.readFileSync(path.join(s.sec, 'PRIORITIES.md'), 'utf8');
  assert.match(prio, /## P1 — Critique/);
  assert.match(prio, /Injection dans la recherche produit/);
  assert.match(prio, new RegExp(`\\[${SQL.replace(/\./g, '\\.')}:17\\]\\([^)]+#L17\\)`));
  const r2 = fin(s, ['--threshold', 'critical']);
  assert.strictEqual(r2.status, 0);
});

test('findings vides + ledger vide : ok, code 0', () => {
  const s = secDir([], 'absent');
  assert.strictEqual(fin(s).status, 0);
  assert.deepStrictEqual(summary(s), { confirmed: 0, needs_validation: 0, rejected: 0, cross_hints: 0, status: 'ok' });
});

test('run partiel (run_status incomplete) : failed, fichiers gardés', () => {
  const s = secDir([], 'absent', { meta: { run_status: 'incomplete' } });
  assert.strictEqual(fin(s).status, 2);
  assert.strictEqual(summary(s).status, 'failed');
  assert.ok(fs.existsSync(path.join(s.sec, 'findings.json')));
});

test('ledger invalide ou rapport manquant : failed', () => {
  const s = secDir([], 'absent');
  fs.writeFileSync(path.join(s.sec, 'coverage-ledger.json'), '{"x":1}');
  fs.rmSync(path.join(s.sec, 'REPORT.md'));
  assert.strictEqual(fin(s).status, 2);
  const f = fs.readFileSync(path.join(s.sec, 'failure.txt'), 'utf8');
  assert.match(f, /ledger invalide/);
  assert.match(f, /REPORT\.md absent/);
});

test('scope : security-deep donne mode deep et budget deep ; check ne crée pas de ledger', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dscope-'));
  const repo = path.join(d, 'shop');
  sh('bash', [path.join(root, 'eval', 'setup-fixture.sh'), 'security-fast', repo]);
  const ctx = (cmd) => JSON.parse(fs.readFileSync(path.join(js('scope.cjs', [repo, '--command', cmd, '--host', 'claude']).stdout.trim(), 'context.json'), 'utf8'));
  const deep = ctx('security-deep');
  assert.strictEqual(deep.mode, 'deep');
  assert.deepStrictEqual(deep.budget, { max_minutes: 90, max_tokens: 1500000 });
  assert.notStrictEqual(ctx('check').mode, 'deep');
  const found = sh('find', [d, '-name', 'coverage-ledger.json']).stdout.trim();
  assert.strictEqual(found, '');
});

test('l’orchestrateur et les skills ne branchent le deep que sur security-deep', () => {
  for (const f of ['agents/director.md', 'skills/check/SKILL.md', 'skills/security/SKILL.md', 'agents/security/orchestrator.md']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, f), 'utf8').replace(/security-deep/g, ''), /deep\.md|check-deep-prereqs|finalize-deep/, f);
  }
});

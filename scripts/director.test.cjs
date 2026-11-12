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
const SQL = 'src/main/java/com/acme/shop/adapters/persistence/ProductSearch.java';
const DOM = 'src/main/java/com/acme/shop/domain/notify/OrderNotifier.java';
const QUOTE = `return st.executeQuery("SELECT * FROM product WHERE name = '" + name + "'");`;
const AXES = ['architecture', 'naming', 'tests', 'errors', 'simplicity'];

function setup() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dir-'));
  const repo = path.join(d, 'shop');
  assert.strictEqual(sh('bash', [path.join(root, 'eval', 'setup-fixture.sh'), 'check-both', repo]).status, 0);
  const sc = js('scope.cjs', [repo, '--command', 'check', '--host', 'claude']);
  assert.strictEqual(sc.status, 0, sc.stderr);
  return { d, repo, run: sc.stdout.trim() };
}
function review(s, byAxis = {}, skip = []) {
  for (const a of AXES) if (!skip.includes(a)) assert.strictEqual(js('save-findings.cjs', [a, s.run], { input: JSON.stringify(byAxis[a] || []) }).status, 0);
  return js('build-report.cjs', [s.run]);
}
const archFinding = { id: 'architecture:domain-spring', axis: 'architecture', severity: 'blocking', file: DOM, line: 3, title: 'Le domaine importe Spring.', evidence: 'import org.springframework.stereotype.Component;', rule: 'layers.domain.forbidden_imports', source: 'agent' };
function security(s, { verdict = 'needs_validation' } = {}) {
  const r = sh('bash', [path.join(__dirname, 'prepare-security-dir.sh'), s.run]);
  assert.strictEqual(r.status, 0, r.stderr);
  const sec = r.stdout.trim();
  assert.strictEqual(sec, path.join(s.run, 'security'));
  const f = (a, i) => js('security-fast.cjs', a, { input: i });
  assert.strictEqual(f(['prepare', s.run, sec]).status, 0);
  assert.strictEqual(f(['save-candidates', sec], JSON.stringify([{ kind: 'injection', title: 'Requête SQL construite par concaténation', claim: 'Le paramètre est concaténé dans la requête.', file: SQL, line: 17, quote: QUOTE }])).status, 0);
  f(['verifier-prompts', sec]);
  f(['save-verdict', sec, '1'], JSON.stringify({ verdict, blocker: 'Chemin non rejoué.', validation_plan: { local: 'Rejouer en bac à sable.' } }));
  const fin = f(['finalize', sec, '--target', s.repo]);
  assert.strictEqual(fin.status, 0, fin.stderr);
  return sec;
}

test('fixture check-both : deux rapports séparés, résumé conforme, code 1, directeur aveugle', () => {
  const s = setup();
  assert.strictEqual(review(s, { architecture: [archFinding] }).status, 1);
  const sec = security(s);
  const r = js('build-summary.cjs', [s.run]);
  assert.strictEqual(r.status, 1, r.stderr);
  assert.match(r.stdout, /Revue de code   → .*REVIEW\.md\s+1 bloquant · 0 à corriger · 0 suggestion\n/);
  assert.match(r.stdout, new RegExp(`Sécurité        → ${sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+0 confirmed · 1 needs_validation\\n`));
  assert.match(r.stdout, /Pistes croisées → 0 transmise à la sécurité/);
  assert.match(r.stdout, /Durée          → /);
  assert.match(r.stdout, /Tokens         → inconnu/);
  assert.doesNotMatch(r.stdout, /SQL|concaténation|ProductSearch/);
  const usage = JSON.parse(fs.readFileSync(path.join(s.run, 'usage.json'), 'utf8'));
  assert.strictEqual(usage.tokens, 'unknown');
  assert.ok(Number.isInteger(usage.elapsed_seconds));
  assert.ok(usage.finished_at);
  const fj = path.join(sec, 'findings.json');
  const reviewMd = path.join(s.run, 'audit', 'REVIEW.md');
  assert.strictEqual(sh('bash', [path.join(__dirname, 'assert-review-has-no-security.sh'), reviewMd, fj]).status, 0);
  assert.strictEqual(sh('bash', [path.join(__dirname, 'assert-director-blind.sh'), fj, path.join(s.run, 'director'), path.join(s.run, 'summary.txt')]).status, 0);
  // contrôle négatif : un directeur qui aurait vu un titre
  fs.writeFileSync(path.join(s.run, 'director', 'trace', 'msg.txt'), 'Requête SQL construite par concaténation');
  assert.strictEqual(sh('bash', [path.join(__dirname, 'assert-director-blind.sh'), fj, path.join(s.run, 'director')]).status, 1);
});

test('sécurité en timeout (1 s) : failed, revue propre -> 2, revue bloquante -> 1, REVIEW.md présent', () => {
  for (const [findings, code] of [[[], 2], [[archFinding], 1]]) {
    const s = setup();
    review(s, { architecture: findings });
    const secDir = path.join(s.d, 'sec');
    fs.mkdirSync(secDir);
    const w = js('await-pipeline.cjs', ['security', secDir, '--timeout', '1']);
    assert.strictEqual(w.status, 2);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(secDir, 'summary.json'), 'utf8')).status, 'failed');
    const r = js('build-summary.cjs', [s.run, '--sec', secDir, '--sequential']);
    assert.strictEqual(r.status, code, r.stdout);
    assert.match(r.stdout, /Sécurité        → échec \(délai\), pas de rapport/);
    assert.match(r.stdout, /pipelines séquentiels/);
    assert.ok(fs.existsSync(path.join(s.run, 'audit', 'REVIEW.md')));
  }
});

test('revue en erreur, sécurité ok : code 2 ; avec confirmed au seuil : code 1', () => {
  const s = setup();
  review(s, {}, ['tests']); // axe tests manquant
  const sec = security(s);
  let r = js('build-summary.cjs', [s.run, '--sec', sec]);
  assert.strictEqual(r.status, 2);
  assert.match(r.stdout, /Axes manquants  → tests/);
  fs.writeFileSync(path.join(sec, 'summary.json'), JSON.stringify({ confirmed: 1, needs_validation: 0, rejected: 0, cross_hints: 0, status: 'ok' }));
  fs.writeFileSync(path.join(sec, 'exit-code'), '1');
  r = js('build-summary.cjs', [s.run, '--sec', sec]);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /1 confirmed/);
});

test('revue absente : ligne en échec, code 2 si la sécurité est ok', () => {
  const s = setup();
  const sec = security(s);
  const r = js('build-summary.cjs', [s.run, '--sec', sec]);
  assert.strictEqual(r.status, 2);
  assert.match(r.stdout, /Revue de code   → échec, pas de rapport/);
});

test('review seule ne crée pas audit/security hors du run', () => {
  const s = setup();
  review(s);
  assert.deepStrictEqual(fs.readdirSync(path.join(s.repo, '.review')).sort(), ['rules.yml', 'runs']);
  assert.ok(fs.existsSync(path.join(s.run, 'audit', 'REVIEW.md')));
  assert.ok(!fs.existsSync(path.join(s.run, 'security')));
});

test('pistes croisées : add-hints ne vérifie que les nouvelles ; budget épuisé -> bloqueur dédié', () => {
  const s = setup();
  const sec = security(s);
  fs.writeFileSync(path.join(s.run, 'cross-hints.json'), JSON.stringify([
    { file: SQL, line: 17, note: 'déjà chassé', from: 'simplicity' },
    { file: DOM, line: 3, note: 'import suspect', from: 'simplicity' }]));
  const a = js('security-fast.cjs', ['add-hints', s.run, sec]);
  assert.strictEqual(a.status, 0, a.stderr);
  assert.match(a.stdout, /pistes ajoutées : 1 \(2\)/);
  const f = js('security-fast.cjs', ['finalize', sec, '--target', s.repo, '--budget-exhausted']);
  assert.strictEqual(f.status, 0, f.stderr);
  const fs2 = JSON.parse(fs.readFileSync(path.join(sec, 'findings.json'), 'utf8'));
  const hint = fs2.find((x) => x.evidence[0].file === DOM);
  assert.ok(hint.blockers.includes('Budget atteint avant vérification.'));
  const r = js('build-summary.cjs', [s.run, '--sec', sec]);
  assert.match(r.stdout, /Pistes croisées → 2 transmises à la sécurité/);
});

test('security.access : none refuse security et check, pas review ; security-deep et check-deep exigent deep', () => {
  const s = setup();
  const rules = path.join(s.repo, '.review', 'rules.yml');
  const set = (v) => fs.writeFileSync(rules, fs.readFileSync(rules, 'utf8').replace(/access: \w+/, `access: ${v}`));
  const ck = (c) => js('check-access.cjs', [s.repo, c]).status;
  const cmds = ['review', 'security', 'check', 'security-deep', 'check-deep'];
  set('none');
  assert.deepStrictEqual(cmds.map(ck), [0, 3, 3, 3, 3]);
  set('fast');
  assert.deepStrictEqual(cmds.map(ck), [0, 0, 0, 3, 3]);
  set('deep');
  assert.deepStrictEqual(cmds.map(ck), [0, 0, 0, 0, 0]);
});

test('scope check-deep : mode deep et budget deep ; check reste hors deep', () => {
  const s = setup();
  const rules = path.join(s.repo, '.review', 'rules.yml');
  fs.writeFileSync(rules, fs.readFileSync(rules, 'utf8').replace(/access: \w+/, 'access: deep'));
  // Attendre 1 s : run-id = timestamp UTC à la seconde, sinon collision avec s.run.
  const start = Date.now();
  while (Date.now() - start < 1100) { /* pause */ }
  const deepCheck = js('scope.cjs', [s.repo, '--command', 'check-deep', '--host', 'claude']);
  assert.strictEqual(deepCheck.status, 0, deepCheck.stderr);
  const deepRun = deepCheck.stdout.trim();
  assert.notStrictEqual(deepRun, s.run);
  const ctx = JSON.parse(fs.readFileSync(path.join(deepRun, 'context.json'), 'utf8'));
  assert.strictEqual(ctx.command, 'check-deep');
  assert.strictEqual(ctx.mode, 'deep');
  assert.deepStrictEqual(ctx.budget, { max_minutes: 90, max_tokens: 1500000 });
  const checkCtx = JSON.parse(fs.readFileSync(path.join(s.run, 'context.json'), 'utf8'));
  assert.strictEqual(checkCtx.command, 'check');
  assert.notStrictEqual(checkCtx.mode, 'deep');
});

test('check-deep : adaptateurs et skill présents ; check ne lance pas le deep', () => {
  for (const f of [
    'agents/director-deep.md',
    'skills/check-deep/SKILL.md',
    'cursor/agents/director-deep.md',
    'claude/agents/director-deep.md',
    'com.github.copilot/agents/director-deep.agent.md',
    'ai.mistral.vibe/agents/director-deep.toml'
  ]) assert.ok(fs.existsSync(path.join(root, f)), f);
  const skill = fs.readFileSync(path.join(root, 'skills/check-deep/SKILL.md'), 'utf8');
  const dir = fs.readFileSync(path.join(root, 'agents/director-deep.md'), 'utf8');
  assert.match(skill, /director-deep\.md/);
  assert.match(dir, /agents\/security\/deep\.md/);
  assert.match(dir, /Ne pas lancer.*add-hints|Pas de pistes croisées/);
  assert.match(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'), /director-deep\.md/);
  for (const f of ['agents/director.md', 'skills/check/SKILL.md']) {
    assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /check-deep/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, f), 'utf8').replace(/security-deep|check-deep/g, ''), /deep\.md|finalize-deep|check-deep-prereqs/, f);
  }
});

test('scope : context porte security_access et le budget du mode', () => {
  const s = setup();
  const ctx = JSON.parse(fs.readFileSync(path.join(s.run, 'context.json'), 'utf8'));
  assert.strictEqual(ctx.security_access, 'fast');
  assert.deepStrictEqual(ctx.budget, { max_minutes: 5, max_tokens: 80000 });
});

test('build-summary : préserve tokens connus dans usage.json', () => {
  const s = setup();
  review(s);
  security(s);
  fs.writeFileSync(path.join(s.run, 'usage.json'), JSON.stringify({ tokens: 99001 }) + '\n');
  const r = js('build-summary.cjs', [s.run]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /Tokens         → 99001/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(s.run, 'usage.json'), 'utf8')).tokens, 99001);
});

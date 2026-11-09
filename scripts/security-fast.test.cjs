'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...o, env: { ...process.env, CODE_CHECK_HOST: 'claude', ...(o.env || {}) } });
const fast = (args, input, o = {}) => sh('node', [path.join(__dirname, 'security-fast.cjs'), ...args], { input, ...o });
const SQL = 'src/main/java/com/acme/shop/adapters/persistence/ProductSearch.java';
const CTRL = 'src/main/java/com/acme/shop/adapters/web/ProductController.java';
const QUOTE = `return st.executeQuery("SELECT * FROM product WHERE name = '" + name + "'");`;

// Dépôt jetable depuis le fixture, run de revue (scope) et dossier sécurité (prepare-security-dir).
function setup() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sf-'));
  const repo = path.join(d, 'shop');
  assert.strictEqual(sh('bash', [path.join(root, 'eval', 'setup-fixture.sh'), 'security-fast', repo]).status, 0);
  const sc = sh('node', [path.join(__dirname, 'scope.cjs'), repo, '--command', 'review', '--host', 'claude']);
  assert.strictEqual(sc.status, 0, sc.stderr);
  const runDir = sc.stdout.trim();
  const runId = path.basename(runDir);
  const p = sh('bash', [path.join(__dirname, 'prepare-security-dir.sh'), 'shop', runId, runDir], { cwd: repo });
  assert.strictEqual(p.status, 0, p.stderr);
  const secDir = p.stdout.trim();
  assert.strictEqual(fs.readFileSync(path.join(runDir, 'security-dir.path'), 'utf8').trim(), secDir);
  assert.strictEqual(fast(['prepare', runDir, secDir]).status, 0);
  return { repo, runDir, secDir };
}
const hunterOut = [{ kind: 'injection', title: 'Requête SQL construite par concaténation', claim: "Le paramètre name est concaténé dans la requête sans paramétrage.", file: SQL, line: 17, quote: QUOTE }];
const verdictNV = { verdict: 'needs_validation', blocker: "Le chemin d'appel depuis la route n'a pas été rejoué.", validation_plan: { local: "Appeler find avec name valant ' OR '1'='1 sur une base de test." } };

function pipeline(s, cands, verdict) {
  assert.strictEqual(fast(['save-candidates', s.secDir], JSON.stringify(cands)).status, 0);
  assert.strictEqual(fast(['verifier-prompts', s.secDir]).status, 0);
  if (verdict) assert.strictEqual(fast(['save-verdict', s.secDir, '1'], JSON.stringify(verdict)).status, 0);
  return fast(['finalize', s.secDir, '--target', s.repo]);
}

test('cas planté : needs_validation, validateur vendor ok, 0700, pas de confirmed', () => {
  const s = setup();
  const r = pipeline(s, hunterOut, verdictNV);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /concaténation|SQL/); // aucun titre dans le terminal
  const f = JSON.parse(fs.readFileSync(path.join(s.secDir, 'findings.json'), 'utf8'));
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].verdict, 'needs_validation');
  assert.strictEqual(f[0].evidence[0].file, SQL);
  const v = sh('node', [path.join(__dirname, 'validate-security.cjs'), path.join(s.secDir, 'findings.json'), '--target', s.repo]);
  assert.strictEqual(v.status, 0, v.stderr);
  for (const n of ['REPORT.md', 'FINDINGS-DETAIL.md', 'NEEDS-VALIDATION.md', 'summary.json']) assert.ok(fs.existsSync(path.join(s.secDir, n)), n);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(s.secDir, 'summary.json'), 'utf8')), { confirmed: 0, needs_validation: 1, rejected: 0, cross_hints: 0, status: 'ok' });
  assert.strictEqual(fs.statSync(s.secDir).mode & 0o777, 0o700);
  assert.match(fs.readFileSync(path.join(s.secDir, 'verify', '1.prompt.md'), 'utf8'), /Tu ne vois pas le raisonnement du chasseur/);
});

test('un verdict confirmed du vérificateur est rétrogradé en needs_validation', () => {
  const s = setup();
  const r = pipeline(s, hunterOut, { verdict: 'confirmed', severity: 'critical' });
  assert.strictEqual(r.status, 0, r.stderr);
  const f = JSON.parse(fs.readFileSync(path.join(s.secDir, 'findings.json'), 'utf8'));
  assert.strictEqual(f[0].verdict, 'needs_validation');
  assert.ok(f[0].blockers.some((b) => /exécution locale/.test(b)));
});

test('le validateur maison refuse un confirmed en fast', () => {
  const s = setup();
  pipeline(s, hunterOut, verdictNV);
  const fp = path.join(s.secDir, 'findings.json');
  const f = JSON.parse(fs.readFileSync(fp, 'utf8'));
  fs.writeFileSync(fp, JSON.stringify([{ ...f[0], verdict: 'confirmed' }]));
  assert.notStrictEqual(sh('node', [path.join(__dirname, 'validate-security.cjs'), fp, '--target', s.repo]).status, 0);
});

test('diff sans piste : findings.json vide valide, code 0', () => {
  const s = setup();
  const r = pipeline(s, [], null);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(s.secDir, 'findings.json'), 'utf8')), []);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(s.secDir, 'summary.json'), 'utf8')).status, 'ok');
});

test('citation inventée : candidat écarté', () => {
  const s = setup();
  const r = fast(['save-candidates', s.secDir], JSON.stringify([{ ...hunterOut[0], quote: 'st.executeUpdate(x);' }]));
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /quote absente/);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(s.secDir, 'candidates.json'), 'utf8')), []);
});

test('indice de revue : candidat, bloqueur initial, rejected si le vérificateur invalide', () => {
  const d = setup();
  fs.writeFileSync(path.join(d.runDir, 'cross-hints.json'), JSON.stringify([
    { file: CTRL, line: 15, note: 'appel de recherche avec un paramètre brut', from: 'simplicity' },
    { file: 'src/absent/Nope.java', line: 3, note: 'fantôme', from: 'simplicity' }]));
  assert.strictEqual(fast(['prepare', d.runDir, d.secDir]).status, 0);
  const meta = JSON.parse(fs.readFileSync(path.join(d.secDir, 'meta.json'), 'utf8'));
  assert.strictEqual(meta.cross_hints, 1);
  assert.strictEqual(meta.cross_hints_unresolved, 1);
  const r = pipeline(d, [], { verdict: 'rejected', reason: 'Le paramètre est une constante côté appelant.' });
  assert.strictEqual(r.status, 0, r.stderr);
  const f = JSON.parse(fs.readFileSync(path.join(d.secDir, 'findings.json'), 'utf8'));
  assert.strictEqual(f[0].verdict, 'rejected');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(d.secDir, 'summary.json'), 'utf8')).cross_hints, 1);
});

test('rejected sans raison : verdict refusé', () => {
  const s = setup();
  fast(['save-candidates', s.secDir], JSON.stringify(hunterOut));
  assert.notStrictEqual(fast(['save-verdict', s.secDir, '1'], JSON.stringify({ verdict: 'rejected' })).status, 0);
});

test('validation refusée : une réécriture, puis failed, code 2, aucun markdown', () => {
  const s = setup();
  const r1 = pipeline(s, hunterOut, verdictNV);
  assert.strictEqual(r1.status, 0);
  // findings.json corrompu après coup (tri cassé + fichier absent) : le validateur refuse deux fois
  const cf = path.join(s.secDir, 'candidates.json');
  const c = JSON.parse(fs.readFileSync(cf, 'utf8'));
  c[0].file = 'src/inexistant/X.java';
  fs.writeFileSync(cf, JSON.stringify(c));
  fs.rmSync(path.join(s.secDir, 'finalize.attempts'), { force: true });
  const r0 = fast(['finalize', s.secDir, '--target', s.repo]);
  assert.strictEqual(r0.status, 4);
  const r2 = fast(['finalize', s.secDir, '--target', s.repo]);
  assert.strictEqual(r2.status, 2);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(s.secDir, 'summary.json'), 'utf8')).status, 'failed');
  assert.ok(!fs.existsSync(path.join(s.secDir, 'REPORT.md')));
});

test('assert-review-has-no-security : ok sans fuite (nom de fichier partagé toléré), échec avec titre ou citation', () => {
  const s = setup();
  pipeline(s, hunterOut, verdictNV);
  const fj = path.join(s.secDir, 'findings.json');
  const assertSh = path.join(__dirname, 'assert-review-has-no-security.sh');
  const review = path.join(s.runDir, 'REVIEW.md');
  fs.writeFileSync(review, `# Revue de code\n\n- ${SQL.split('/').pop()} : nommage du service à revoir.\nDes points ont été transmis au rapport sécurité.\n`);
  assert.strictEqual(sh('bash', [assertSh, review, fj]).status, 0);
  fs.writeFileSync(review, `# Revue\n- ${hunterOut[0].title}\n`);
  assert.strictEqual(sh('bash', [assertSh, review, fj]).status, 1);
  fs.writeFileSync(review, `# Revue\n\`${QUOTE}\`\n`);
  assert.strictEqual(sh('bash', [assertSh, review, fj]).status, 1);
});

test('prepare-security-dir : deux dépôts du même nom ne partagent pas de dossier', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sd-'));
  const mk = (sub) => { const r = path.join(d, sub, 'app'); fs.mkdirSync(r, { recursive: true }); sh('git', ['-C', r, 'init', '-q']); return r; };
  const a = mk('a'), b = mk('b');
  const env = { CODE_CHECK_SECURITY_DIR: path.join(d, 'sec') };
  const da = sh('bash', [path.join(__dirname, 'prepare-security-dir.sh'), 'app', 'run1'], { cwd: a, env }).stdout.trim();
  const db = sh('bash', [path.join(__dirname, 'prepare-security-dir.sh'), 'app', 'run1'], { cwd: b, env }).stdout.trim();
  assert.notStrictEqual(da, db);
  assert.ok(da.startsWith(path.join(d, 'sec', 'app', 'runs')));
  assert.match(path.basename(path.dirname(path.dirname(db))), /^app-[0-9a-f]{12}$/);
  assert.strictEqual(fs.statSync(db).mode & 0o777, 0o700);
});

test('trace inventée par le chasseur : abandonnée, le pipeline passe', () => {
  const s = setup();
  const bad = [{ ...hunterOut[0], trace: [{ kind: 'entrypoint', file: CTRL, line: 46, scope: 'find', description: 'entrée' }] }];
  const r = pipeline(s, bad, verdictNV);
  assert.strictEqual(r.status, 0, r.stderr);
  const f = JSON.parse(fs.readFileSync(path.join(s.secDir, 'findings.json'), 'utf8'));
  assert.strictEqual(f[0].trace.length, 1);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scope = path.join(__dirname, 'scope.cjs');
const example = path.join(__dirname, '..', 'templates', 'rules.example.yml');
function repo(withRules) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
  const sh = (...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8' });
  sh('init', '-q', '-b', 'main'); sh('config', 'user.email', 't@t'); sh('config', 'user.name', 't');
  if (withRules) { fs.mkdirSync(path.join(d, '.review')); fs.copyFileSync(example, path.join(d, '.review', 'rules.yml')); }
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  sh('add', '-A'); sh('commit', '-qm', 'init');
  fs.writeFileSync(path.join(d, 'a.ts'), 'export const a = 1;\n');
  sh('add', '-N', 'a.ts');
  return d;
}
const run = (d, env = {}) => spawnSync('node', [scope, d], { encoding: 'utf8', env: { ...process.env, CODE_CHECK_HOST: 'claude', ...env } });

test('avec rules.yml : context.json et diff.patch écrits', () => {
  const d = repo(true);
  const r = run(d);
  assert.strictEqual(r.status, 0, r.stderr);
  const dir = r.stdout.trim();
  const ctx = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8'));
  assert.strictEqual(ctx.host, 'claude');
  assert.strictEqual(ctx.mode, 'fast');
  assert.deepStrictEqual(ctx.stack, ['node']);
  assert.ok(ctx.axes.includes('simplicity'));
  assert.match(ctx.rules_sha256, /^[0-9a-f]{64}$/);
  assert.ok(fs.existsSync(path.join(dir, 'diff.patch')));
  assert.ok(!fs.existsSync(path.join(d, '.review', path.basename(d))));
});
test('sans rules.yml : code 3, aucun dossier de run', () => {
  const d = repo(false);
  const r = run(d);
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /rules\.yml manquant/);
  assert.ok(!fs.existsSync(path.join(d, '.review')));
});
test('hôte invalide : code 3', () => {
  assert.strictEqual(run(repo(true), { CODE_CHECK_HOST: 'foo' }).status, 3);
});

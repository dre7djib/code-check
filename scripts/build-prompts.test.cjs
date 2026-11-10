'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'build-prompts.cjs');
const rules = fs.readFileSync(path.join(__dirname, '..', 'templates', 'rules.example.yml'), 'utf8');

function setup(compact) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-bp-'));
  fs.mkdirSync(path.join(d, 'repo', '.review'), { recursive: true });
  fs.writeFileSync(path.join(d, 'repo', '.review', 'rules.yml'), rules);
  fs.mkdirSync(path.join(d, 'run', 'audit'), { recursive: true });
  fs.writeFileSync(path.join(d, 'run', 'context.json'), JSON.stringify({ axes: ['architecture', 'simplicity'], repo: { path: path.join(d, 'repo') } }));
  if (compact) fs.writeFileSync(path.join(d, 'run', 'audit', 'rules.compact.txt'), compact);
  return d;
}
const layerNames = [...rules.matchAll(/- name: (\w+)/g)].map((m) => m[1]);

test('full : rules.yml intégral dans chaque prompt', () => {
  const d = setup();
  assert.strictEqual(spawnSync('node', [script, path.join(d, 'run'), '--rules', 'full']).status, 0);
  const p = fs.readFileSync(path.join(d, 'run', 'audit', 'trace', 'simplicity.prompt.md'), 'utf8');
  assert.ok(p.includes(rules.trimEnd()));
});
test('compact : toute couche de rules.yml reste dans le prompt archivé', () => {
  const d = setup('naming: suffix Transactional si @Transactional. tests: fix si absent.');
  assert.strictEqual(spawnSync('node', [script, path.join(d, 'run'), '--rules', 'compact']).status, 0);
  for (const axis of ['architecture', 'simplicity']) {
    const p = fs.readFileSync(path.join(d, 'run', 'audit', 'trace', `${axis}.prompt.md`), 'utf8');
    for (const l of layerNames) assert.ok(p.includes(l), `couche ${l} absente du prompt ${axis}`);
    assert.ok(p.includes('forbidden_imports'));
  }
  assert.ok(JSON.parse(fs.readFileSync(path.join(d, 'run', 'audit', 'trace', 'meta.json'), 'utf8')).rules === 'compact');
});
test('compact sans rules.compact.txt : échec', () => {
  const d = setup();
  assert.strictEqual(spawnSync('node', [script, path.join(d, 'run'), '--rules', 'compact']).status, 1);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { formatDuration, formatTokens, finalizeUsage } = require('./usage-metrics.cjs');

test('formatDuration : secondes, minutes, heures', () => {
  assert.strictEqual(formatDuration(0), '0 s');
  assert.strictEqual(formatDuration(12), '12 s');
  assert.strictEqual(formatDuration(60), '1 min');
  assert.strictEqual(formatDuration(222), '3 min 42 s');
  assert.strictEqual(formatDuration(3600), '1 h');
  assert.strictEqual(formatDuration(3900), '1 h 5 min');
});

test('formatTokens : nombre ou inconnu', () => {
  assert.strictEqual(formatTokens(45230), '45230');
  assert.strictEqual(formatTokens('unknown'), 'inconnu');
  assert.strictEqual(formatTokens(undefined), 'inconnu');
  assert.strictEqual(formatTokens(-1), 'inconnu');
});

test('finalizeUsage : écrit usage.json et lignes ; préserve tokens connus', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-usage-'));
  const start = new Date(Date.now() - 5000).toISOString();
  fs.writeFileSync(path.join(d, 'usage.json'), JSON.stringify({ tokens: 12345 }) + '\n');
  const { usage, lines } = finalizeUsage(d, start);
  assert.strictEqual(usage.tokens, 12345);
  assert.ok(usage.elapsed_seconds >= 4);
  assert.ok(usage.finished_at);
  assert.match(lines[0], /^Durée          → /);
  assert.strictEqual(lines[1], 'Tokens         → 12345');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(d, 'usage.json'), 'utf8')), usage);
});

test('finalizeUsage : tokens unknown si absent', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-usage-'));
  const { usage, lines } = finalizeUsage(d, new Date().toISOString());
  assert.strictEqual(usage.tokens, 'unknown');
  assert.strictEqual(lines[1], 'Tokens         → inconnu');
});

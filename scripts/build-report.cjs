#!/usr/bin/env node
'use strict';
// Fusion, dédoublonnage et rapports. usage: build-report.cjs <dossier-de-run>
// Lit deterministic/review-findings.json et review/findings/<axe>.json.
// Écrit review/merged.json, review/REVIEW.md, review/REVIEW-DETAIL.md, cross-hints.json, summary.txt.
// Code de sortie : 1 si un bloquant, sinon 2 si un axe manque, sinon 0 ; 3 si context.json illisible.
const fs = require('node:fs');
const path = require('node:path');
const { validateFinding } = require('./validate-review-findings.cjs');

const runDir = path.resolve(process.argv[2] || '');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };
const ctx = readJson(path.join(runDir, 'context.json'));
if (!ctx) { console.error('context.json illisible'); process.exit(3); }

const RANK = { blocking: 0, fix: 1, suggestion: 2 };
const stats = { schema: 0, offAxis: 0 };
const all = []; // { f, order }
const crossHints = [];

function take(list, expectedAxis) {
  for (const f of list) {
    if (validateFinding(f).length) { stats.schema++; continue; }
    if (expectedAxis && f.axis !== expectedAxis) { stats.offAxis++; continue; }
    if (f.route === 'security') { crossHints.push(f); continue; }
    all.push(f);
  }
}

// déterministe
const det = readJson(path.join(runDir, 'deterministic', 'review-findings.json'));
if (Array.isArray(det)) take(det, null); else if (det !== undefined) stats.schema++;

// reviewers
const missing = [];
const axes = (ctx.axes || []).filter((a) => a !== 'deterministic');
for (const axis of axes) {
  const data = readJson(path.join(runDir, 'review', 'findings', `${axis}.json`));
  if (!Array.isArray(data)) { missing.push(axis); continue; }
  take(data, axis);
}

// seeds : jamais dans le rapport
const seeds = readJson(path.join(runDir, 'deterministic', 'security-seeds.json'));
const seedCount = Array.isArray(seeds) ? seeds.length : 0;

// dédoublonnage file:line
const byKey = new Map();
for (const f of all) {
  const key = `${f.file}:${f.line}`;
  const cur = byKey.get(key);
  if (!cur) { byKey.set(key, { ...f }); continue; }
  const [keep, other] = RANK[f.severity] < RANK[cur.severity] ? [{ ...f }, cur] : [cur, f];
  const also = new Set([...(keep.also_flagged_by || []), ...(other.also_flagged_by || [])]);
  if (other.axis !== keep.axis) also.add(other.axis);
  if (also.size) keep.also_flagged_by = [...also].sort();
  byKey.set(key, keep);
}
// ids uniques
const ids = new Set();
const merged = [...byKey.values()].sort((a, b) =>
  RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
for (const f of merged) {
  let id = f.id, n = 2;
  while (ids.has(id)) id = `${f.id}-${n++}`;
  ids.add(id); f.id = id;
}

// plafond
let max = 10;
try {
  const y = fs.readFileSync(path.join(ctx.repo.path, '.review', 'rules.yml'), 'utf8');
  const m = y.match(/^\s+review_max_findings:\s*(\d+)/m);
  if (m) max = Number(m[1]);
} catch { /* défaut */ }
const shown = merged.slice(0, max);

let skippedArch = false;
try { skippedArch = /architecture déterministe non exécutée/.test(fs.readFileSync(path.join(runDir, 'deterministic', 'raw', 'skipped.txt'), 'utf8')); } catch { /* rien */ }

const SECTIONS = [['blocking', 'Bloquants'], ['fix', 'À corriger'], ['suggestion', 'Suggestions']];
function render(list, detail, total) {
  const head = [`# Revue de code${detail ? ' — détail' : ''}`, `Run ${ctx.run_id} · mode ${ctx.mode} · règles ${String(ctx.rules_sha256 || '').slice(0, 12)}`];
  const notes = [];
  if (missing.length) notes.push(`Axes non exécutés : ${missing.join(', ')}.`);
  if (skippedArch) notes.push('Architecture déterministe non exécutée.');
  const hint = crossHints.length || seedCount ? 'Des points ont été transmis au rapport sécurité.' : '';
  if (!list.length && !notes.length && !hint) return 'Aucun point.\n';
  const out = [...head, ''];
  if (notes.length) out.push(...notes, '');
  if (!list.length) out.push('Aucun point.', '');
  for (const [sev, title] of SECTIONS) {
    const items = list.filter((f) => f.severity === sev);
    if (!items.length) continue;
    out.push(`## ${title}`, '');
    for (const f of items) {
      out.push(`- **${f.file}:${f.line}** — ${f.title}`);
      out.push(`  règle \`${f.rule}\` · axe ${f.axis} · source ${f.source}`);
      if (detail) {
        out.push('  ```', ...f.evidence.split('\n').map((l) => `  ${l}`), '  ```');
        if (f.also_flagged_by) out.push(`  aussi signalé par : ${f.also_flagged_by.join(', ')}`);
      }
    }
    out.push('');
  }
  if (!detail) out.push(`${list.length} findings affichés sur ${total}. Le détail est dans REVIEW-DETAIL.md.`, '');
  if (hint) out.push(hint, '');
  return out.join('\n');
}

const reviewDir = path.join(runDir, 'review');
fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(path.join(reviewDir, 'merged.json'), JSON.stringify(merged, null, 2) + '\n');
fs.writeFileSync(path.join(reviewDir, 'REVIEW.md'), render(shown, false, merged.length));
fs.writeFileSync(path.join(reviewDir, 'REVIEW-DETAIL.md'), render(merged, true, merged.length));
fs.writeFileSync(path.join(runDir, 'cross-hints.json'), JSON.stringify(crossHints, null, 2) + '\n');

const count = (s) => merged.filter((f) => f.severity === s).length;
const summary = [
  `Revue de code   → ${path.join(reviewDir, 'REVIEW.md')}   ${merged.length} findings (${count('blocking')} bloquants, ${count('fix')} à corriger, ${count('suggestion')} suggestions)`,
  'Sécurité        → ignorée',
  `Écarts schéma   → ${stats.schema}`,
  `Hors axe        → ${stats.offAxis}`,
  `Axes manquants  → ${missing.length ? missing.join(', ') : 'aucun'}`,
  `Hôte            → ${ctx.host}`,
  ''
].join('\n');
fs.writeFileSync(path.join(runDir, 'summary.txt'), summary);
process.stdout.write(summary);
process.exit(count('blocking') ? 1 : missing.length ? 2 : 0);

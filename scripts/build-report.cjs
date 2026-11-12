#!/usr/bin/env node
'use strict';
// Fusion, dédoublonnage et rapports. usage: build-report.cjs <dossier-de-run>
// Lit deterministic/review-findings.json et audit/findings/<axe>.json.
// Écrit audit/merged.json, audit/REVIEW.md, audit/REVIEW-DETAIL.md, cross-hints.json, summary.txt.
// Code de sortie : 1 si un bloquant, sinon 2 si un axe manque, sinon 0 ; 3 si context.json illisible.
const fs = require('node:fs');
const path = require('node:path');
const { validateFinding } = require('./validate-review-findings.cjs');
const { finalizeUsage } = require('./usage-metrics.cjs');

const runDir = path.resolve(process.argv[2] || '');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };
const ctx = readJson(path.join(runDir, 'context.json'));
if (!ctx) { console.error('context.json illisible'); process.exit(3); }

const RANK = { blocking: 0, fix: 1, suggestion: 2 };
const stats = { schema: 0, offAxis: 0, testDup: 0, anchored: 0, unlocated: 0 };
const all = []; // { f, order }
const crossHints = [];

const testsActive = (ctx.axes || []).includes('tests');
const TEST_MISSING = /(\btests?\b.*(manqu|absent|aucun|sans)|(manqu|absent|aucun|sans).*\btests?\b|untested|missing[- ]test|no[- ]test)/i;

// Ancrage des findings d'agent : le fichier doit exister ; si la première ligne de `evidence` se
// trouve dans le fichier, `line` est recalée sur l'occurrence la plus proche. Sinon, une ligne
// hors du fichier fait écarter le finding. Les modèles confondent parfois n° de ligne du diff et du fichier.
const fileCache = new Map();
function fileLines(rel) {
  if (!fileCache.has(rel)) {
    let v = null;
    try { v = fs.readFileSync(path.join(ctx.repo.path, rel), 'utf8').split('\n'); } catch { /* absent */ }
    fileCache.set(rel, v);
  }
  return fileCache.get(rel);
}
function anchor(f) {
  if (f.source !== 'agent') return f;
  const src = fileLines(f.file);
  if (!src) { stats.unlocated++; return null; }
  const first = (f.evidence.split('\n').map((l) => l.trim()).find(Boolean)) || '';
  const hits = first.length >= 6 ? src.flatMap((l, i) => (l.trim() === first ? [i + 1] : [])) : [];
  if (hits.length) {
    const best = hits.reduce((a, b) => (Math.abs(b - f.line) < Math.abs(a - f.line) ? b : a));
    if (best !== f.line) { stats.anchored++; return { ...f, line: best }; }
    return f;
  }
  if (f.line > src.length) { stats.unlocated++; return null; }
  return f;
}

function take(list, expectedAxis) {
  for (const f of list) {
    if (validateFinding(f).length) { stats.schema++; continue; }
    if (expectedAxis && f.axis !== expectedAxis) { stats.offAxis++; continue; }
    // simplicity : jamais blocking en v1.
    if (f.axis === 'simplicity' && f.severity === 'blocking') { stats.offAxis++; continue; }
    // simplicity : un test manquant relève de l'axe tests, supprimé si cet axe est actif.
    if (f.axis === 'simplicity' && testsActive && TEST_MISSING.test(`${f.title} ${f.rule}`)) { stats.testDup++; continue; }
    if (f.route === 'security') { crossHints.push(f); continue; }
    const a = anchor(f);
    if (a) all.push(a);
  }
}

// déterministe
const det = readJson(path.join(runDir, 'deterministic', 'review-findings.json'));
if (Array.isArray(det)) take(det, null); else if (det !== undefined) stats.schema++;

// reviewers
const missing = [];
const axes = (ctx.axes || []).filter((a) => a !== 'deterministic');
for (const axis of axes) {
  const data = readJson(path.join(runDir, 'audit', 'findings', `${axis}.json`));
  if (!Array.isArray(data)) { missing.push(axis); continue; }
  take(data, axis);
}

// pistes du reviewer simplicité : vers cross-hints.json seulement
const sHints = readJson(path.join(runDir, 'audit', 'findings', 'simplicity-hints.json'));
const hintObjs = [];
if (Array.isArray(sHints)) {
  for (const h of sHints) {
    if (h && typeof h.file === 'string' && Number.isInteger(h.line) && typeof h.note === 'string' && !/(^|[\/\\])\.\.([\/\\]|$)|^[\/\\]/.test(h.file)) hintObjs.push({ file: h.file, line: h.line, note: h.note, from: 'simplicity' });
    else stats.schema++;
  }
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
  const hint = crossHints.length || hintObjs.length || seedCount ? 'Des points ont été transmis au rapport sécurité.' : '';
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
  if (!detail && list.length) out.push(`${list.length} findings affichés sur ${total}. Le détail est dans REVIEW-DETAIL.md.`, '');
  if (hint) out.push(hint, '');
  return out.join('\n');
}

const reviewDir = path.join(runDir, 'audit');
fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(path.join(reviewDir, 'merged.json'), JSON.stringify(merged, null, 2) + '\n');
fs.writeFileSync(path.join(reviewDir, 'REVIEW.md'), render(shown, false, merged.length));
fs.writeFileSync(path.join(reviewDir, 'REVIEW-DETAIL.md'), render(merged, true, merged.length));
fs.writeFileSync(path.join(runDir, 'cross-hints.json'), JSON.stringify([...crossHints, ...hintObjs], null, 2) + '\n');

const count = (s) => merged.filter((f) => f.severity === s).length;
const { lines: metricLines } = finalizeUsage(runDir, ctx.created_at);
const summary = [
  `Revue de code   → ${path.join(reviewDir, 'REVIEW.md')}   ${merged.length} findings (${count('blocking')} bloquants, ${count('fix')} à corriger, ${count('suggestion')} suggestions)`,
  'Sécurité        → ignorée',
  `Écarts schéma   → ${stats.schema}`,
  `Hors axe        → ${stats.offAxis}`,
  `Doublons tests  → ${stats.testDup}`,
  `Lignes recalées → ${stats.anchored}`,
  `Introuvables    → ${stats.unlocated}`,
  `Axes manquants  → ${missing.length ? missing.join(', ') : 'aucun'}`,
  `Hôte            → ${ctx.host}`,
  ...metricLines,
  ''
].join('\n');
fs.writeFileSync(path.join(runDir, 'summary.txt'), summary);
process.stdout.write(summary);
process.exit(count('blocking') ? 1 : missing.length ? 2 : 0);

#!/usr/bin/env node
'use strict';
// Résumé de /check : compteurs seulement. Seul objet sécurité lu : summary.json (+ exit-code, un nombre).
// usage: build-summary.cjs <run> [--sec <dossier-sécurité>] [--sequential]
// Écrit <run>/summary.txt, <run>/director/trace/summary.txt, <run>/usage.json s'il manque. Imprime le résumé.
// Code : 1 bloquant de revue ou confirmed >= seuil ; sinon 2 pipeline manquant ; sinon 0 ; 3 si context.json illisible.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const run = path.resolve(process.argv[2] || '');
const args = process.argv.slice(3);
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };
const ctx = readJson(path.join(run, 'context.json'));
if (!ctx) { console.error('context.json illisible'); process.exit(3); }
let sec = args.includes('--sec') ? path.resolve(args[args.indexOf('--sec') + 1]) : null;
if (!sec) { try { sec = fs.readFileSync(path.join(run, 'security-dir.path'), 'utf8').trim(); } catch { sec = null; } }
if (!sec && fs.existsSync(path.join(run, 'security', 'summary.json'))) sec = path.join(run, 'security');

// --- revue
const reviewDir = path.join(run, 'audit');
const merged = readJson(path.join(reviewDir, 'merged.json'));
const reviewDone = fs.existsSync(path.join(reviewDir, 'REVIEW.md')) && Array.isArray(merged);
const missingAxes = (ctx.axes || []).filter((a) => !Array.isArray(readJson(path.join(reviewDir, 'findings', `${a}.json`))));
const n = (s) => (merged || []).filter((f) => f.severity === s).length;
const blocking = reviewDone ? n('blocking') : 0;
const reviewFailed = !reviewDone || missingAxes.length > 0;

// --- sécurité
const sj = sec ? readJson(path.join(sec, 'summary.json')) : undefined;
const secFailed = !sj || sj.status !== 'ok';
let secExit = 2;
if (sec) { try { secExit = Number(fs.readFileSync(path.join(sec, 'exit-code'), 'utf8').trim()); } catch { /* absent */ } }
const secHit = !secFailed && secExit === 1;

const hints = (readJson(path.join(run, 'cross-hints.json')) || []).length;
const plural = (k, one, many) => `${k} ${k > 1 ? many : one}`;

const lines = [];
if (reviewDone) lines.push(`Revue de code   → ${path.join(reviewDir, 'REVIEW.md')}     ${plural(blocking, 'bloquant', 'bloquants')} · ${n('fix')} à corriger · ${plural(n('suggestion'), 'suggestion', 'suggestions')}`);
else lines.push('Revue de code   → échec, pas de rapport');
if (missingAxes.length && reviewDone) lines.push(`Axes manquants  → ${missingAxes.join(', ')}`);
if (!secFailed) lines.push(`Sécurité        → ${sec}     ${sj.confirmed} confirmed · ${sj.needs_validation} needs_validation`);
else lines.push('Sécurité        → échec' + (sec && fs.existsSync(path.join(sec, 'failure.txt')) ? ' (délai)' : '') + ', pas de rapport');
lines.push(`Pistes croisées → ${hints} ${hints > 1 ? 'transmises' : 'transmise'} à la sécurité`);
lines.push(`Hôte            → ${ctx.host} · mode ${ctx.mode}${args.includes('--sequential') ? ' · pipelines séquentiels' : ''}`);
try {
  const head = cp.execFileSync('git', ['-C', ctx.repo.path, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (head !== ctx.repo.head) lines.push(`Diff figé       → le commit a changé pendant le run, le patch déjà écrit fait foi`);
} catch { /* pas de git : rien à dire */ }
const out = lines.join('\n') + '\n';

fs.writeFileSync(path.join(run, 'summary.txt'), out);
fs.mkdirSync(path.join(run, 'director', 'trace'), { recursive: true });
fs.writeFileSync(path.join(run, 'director', 'trace', 'summary.txt'), out);
if (!fs.existsSync(path.join(run, 'usage.json'))) fs.writeFileSync(path.join(run, 'usage.json'), JSON.stringify({ tokens: 'unknown' }) + '\n');
process.stdout.write(out);
process.exit(blocking > 0 || secHit ? 1 : reviewFailed || secFailed ? 2 : 0);

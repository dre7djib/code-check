#!/usr/bin/env node
'use strict';
// Phase 1 : écrit summary.txt du socle et l'affiche. usage: write-summary.cjs <dossier-de-run>
const fs = require('node:fs');
const path = require('node:path');
const runDir = path.resolve(process.argv[2] || '');
let ctx;
try { ctx = JSON.parse(fs.readFileSync(path.join(runDir, 'context.json'), 'utf8')); } catch { console.error('context.json illisible'); process.exit(3); }
const text = [
  `Revue de code   → ${path.join(runDir, 'review', 'REVIEW.md')}   non généré (socle)`,
  'Sécurité        → ignorée',
  'Pistes croisées → 0',
  `Hôte            → ${ctx.host}`,
  ''
].join('\n');
fs.writeFileSync(path.join(runDir, 'summary.txt'), text);
process.stdout.write(text);

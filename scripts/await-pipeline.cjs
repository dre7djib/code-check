#!/usr/bin/env node
'use strict';
// Le directeur n'attend pas au-delà du budget : max_minutes + 1 minute.
// usage: await-pipeline.cjs <review|security> <dossier> --timeout <secondes>
//   review   : <dossier> = run de revue ; attend review/REVIEW.md.
//   security : <dossier> = dossier sécurité ; attend summary.json. Au délai, écrit summary.json
//              {status: failed, compteurs 0} et exit-code 2 : le pipeline absent est marqué failed.
// Code 0 : fini. Code 2 : délai.
const fs = require('node:fs');
const path = require('node:path');
const [kind, dir] = [process.argv[2], path.resolve(process.argv[3] || '')];
const ti = process.argv.indexOf('--timeout');
const timeout = ti > 0 ? Number(process.argv[ti + 1]) : NaN;
if (!['review', 'security'].includes(kind) || !Number.isFinite(timeout)) { console.error('usage: await-pipeline.cjs <review|security> <dossier> --timeout <s>'); process.exit(3); }
const target = kind === 'review' ? path.join(dir, 'review', 'REVIEW.md') : path.join(dir, 'summary.json');
const end = Date.now() + timeout * 1000;
(function poll() {
  if (fs.existsSync(target)) process.exit(0);
  if (Date.now() >= end) {
    if (kind === 'security') {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ confirmed: 0, needs_validation: 0, rejected: 0, cross_hints: 0, status: 'failed' }, null, 2) + '\n');
      fs.writeFileSync(path.join(dir, 'exit-code'), '2');
      fs.writeFileSync(path.join(dir, 'failure.txt'), 'délai\n');
    }
    console.error(`${kind} : délai dépassé`);
    process.exit(2);
  }
  setTimeout(poll, 200);
})();

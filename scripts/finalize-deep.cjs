#!/usr/bin/env node
'use strict';
// Clôture d'un run deep : valide ce que la skill Cloudflare a écrit, écrit summary.json et exit-code.
// usage: finalize-deep.cjs <dossier-sécurité> --target <repo> [--threshold high]
// - coverage-ledger.json : validateur vendor (s'il existe).
// - findings.json : validateur vendor + contrôles du dépôt cible. `confirmed` accepté sauf si
//   prereqs.json dit sandbox=absent (défaut / prereqs manquant = present).
// - run-metadata.json avec run_status != completed, ou un markdown manquant : status failed (fichiers partiels gardés).
// Code : 0 ok ; 1 confirmed >= seuil ; 2 failed.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validate } = require('./validate-security.cjs');
const { writePriorities } = require('./build-priorities.cjs');

const sec = path.resolve(process.argv[2] || '');
const a = process.argv.slice(3);
const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const target = opt('--target');
if (!target) { console.error('usage: finalize-deep.cjs <dossier-sécurité> --target <repo> [--threshold high]'); process.exit(3); }
const SEV = { low: 1, medium: 2, high: 3, critical: 4 };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };

const prereqs = readJson(path.join(sec, 'prereqs.json')) || {};
const sandbox = prereqs.sandbox !== 'absent';
const meta = readJson(path.join(sec, 'run-metadata.json')) || {};
const problems = [];

const ledger = path.join(sec, 'coverage-ledger.json');
if (fs.existsSync(ledger)) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'skills', 'security-audit', 'validate-coverage-ledger.cjs'), ledger], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`ledger invalide : ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
} else problems.push('coverage-ledger.json absent');

const fj = path.join(sec, 'findings.json');
let findings = [];
let findingsOk = false;
if (fs.existsSync(fj)) {
  const errs = validate(fj, path.resolve(target), { allowConfirmed: sandbox });
  if (errs.length) problems.push(...errs.slice(0, 5).map((e) => `findings.json : ${e}`));
  else { findings = readJson(fj) || []; findingsOk = true; }
} else problems.push('findings.json absent');

if (meta.run_status && meta.run_status !== 'completed') problems.push(`run_status ${meta.run_status}`);
for (const f of ['REPORT.md', 'FINDINGS-DETAIL.md', 'NEEDS-VALIDATION.md']) if (!fs.existsSync(path.join(sec, f))) problems.push(`${f} absent`);

const count = (k) => findings.filter((f) => f.verdict === k).length;
const failed = problems.length > 0;
const summary = { confirmed: count('confirmed'), needs_validation: count('needs_validation'), rejected: count('rejected'), cross_hints: 0, status: failed ? 'failed' : 'ok' };
fs.writeFileSync(path.join(sec, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
if (failed) fs.writeFileSync(path.join(sec, 'failure.txt'), problems.join('\n') + '\n');
if (findingsOk) writePriorities(sec, path.resolve(target), findings);
else fs.rmSync(path.join(sec, 'PRIORITIES.md'), { force: true });
const min = SEV[opt('--threshold')] || SEV.high;
const hit = findings.some((f) => f.verdict === 'confirmed' && (SEV[f.severity && f.severity.overall_severity] || 0) >= min);
const code = hit ? 1 : failed ? 2 : 0;
fs.writeFileSync(path.join(sec, 'exit-code'), String(code));
console.log(`sécurité deep : confirmed ${summary.confirmed} · needs_validation ${summary.needs_validation} · rejected ${summary.rejected} · statut ${summary.status}${sandbox ? '' : ' · sandbox absent (pas de confirmed)'}`);
if (failed) console.log(`${problems.length} point(s) en échec, détail dans failure.txt du dossier.`);
console.log(`Dossier : ${sec}`);
process.exit(code);

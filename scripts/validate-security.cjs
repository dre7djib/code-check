#!/usr/bin/env node
'use strict';
// usage: validate-security.cjs <findings.json> --target <repo> [--allow-confirmed]
// 1. Lance le validateur Cloudflare vendoré, inchangé (skills/security-audit/validate-findings.cjs).
// 2. Contrôles maison que le validateur vendor ne fait pas (il ne connaît pas le dépôt cible) :
//    chaque fichier cité existe dans --target, la ligne existe, tri par fingerprint, fingerprint unique,
//    et pas de `confirmed` en mode fast (sans bac à sable) sauf --allow-confirmed.
// Sortie 0 : valide. Sortie 1 : refus, messages sur stderr.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VENDOR = path.join(__dirname, '..', 'skills', 'security-audit', 'validate-findings.cjs');

function safeRel(p) {
  return typeof p === 'string' && p.length > 0 && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').includes('..');
}

function lineCount(file) {
  const t = fs.readFileSync(file, 'utf8');
  return t.endsWith('\n') ? t.split('\n').length - 1 : t.split('\n').length;
}

function validate(findingsPath, target, opts = {}) {
  const errors = [];
  const v = spawnSync(process.execPath, [VENDOR, findingsPath], { encoding: 'utf8' });
  if (v.status !== 0) {
    errors.push(...(v.stderr || v.stdout || 'validateur vendor en échec').trim().split('\n'));
    return errors;
  }
  const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  const root = fs.realpathSync(target);
  const cache = new Map();
  const seen = new Set();
  let prev = '';
  for (const f of findings) {
    const tag = f.fingerprint;
    if (seen.has(tag)) errors.push(`${tag} : fingerprint en double`);
    seen.add(tag);
    if (tag < prev) errors.push(`${tag} : findings non triés par fingerprint`);
    prev = tag;
    if (f.verdict === 'confirmed' && !opts.allowConfirmed) {
      errors.push(`${tag} : verdict confirmed interdit en mode fast sans bac à sable`);
    }
    for (const c of [...(f.trace || []), ...(f.evidence || [])]) {
      if (!safeRel(c.file)) { errors.push(`${tag} : chemin cité invalide (${c.file})`); continue; }
      let real;
      try { real = fs.realpathSync(path.join(root, c.file)); } catch { errors.push(`${tag} : fichier cité absent de la cible (${c.file})`); continue; }
      if (real !== root && !real.startsWith(root + path.sep)) { errors.push(`${tag} : fichier cité hors de la cible (${c.file})`); continue; }
      if (!cache.has(real)) cache.set(real, lineCount(real));
      if (c.line > cache.get(real)) errors.push(`${tag} : ${c.file}:${c.line} dépasse la fin du fichier (${cache.get(real)} lignes)`);
    }
  }
  return errors;
}

module.exports = { validate, safeRel };

if (require.main === module) {
  const a = process.argv.slice(2);
  const file = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--target');
  const ti = a.indexOf('--target');
  const target = ti >= 0 ? a[ti + 1] : null;
  if (!file || !target) { console.error('usage: validate-security.cjs <findings.json> --target <repo> [--allow-confirmed]'); process.exit(1); }
  const errs = validate(file, target, { allowConfirmed: a.includes('--allow-confirmed') });
  if (errs.length) { for (const e of errs) console.error('ERROR:', e); process.exit(1); }
  console.log('PASS');
}

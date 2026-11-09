#!/usr/bin/env node
'use strict';
// rules-loader : vérifie la présence des champs obligatoires de .review/rules.yml,
// calcule le SHA-256. N'interprète pas les règles. Sans dépendance YAML : lecture par lignes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class RulesError extends Error {}

function topBlock(lines, key) {
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return null;
  const block = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j].trim() === '' || /^\s/.test(lines[j])) block.push(lines[j]); else break;
  }
  return block;
}

function parseList(raw) {
  return raw.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function loadRules(repo) {
  const file = path.join(repo, '.review', 'rules.yml');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { throw new RulesError('rules.yml manquant'); }
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+#.*$/, ''));

  const version = lines.find((l) => /^version:/.test(l));
  if (!version || version.replace(/^version:\s*/, '').trim() !== '1') {
    throw new RulesError('rules.yml invalide : version doit valoir 1');
  }
  const arch = topBlock(lines, 'architecture');
  if (!arch || !arch.some((l) => /^\s+layers:\s*$/.test(l))) throw new RulesError('rules.yml invalide : architecture.layers absent');
  if (!topBlock(lines, 'naming')) throw new RulesError('rules.yml invalide : naming absent');

  const axesBlock = topBlock(lines, 'axes');
  const reviewLine = axesBlock && axesBlock.find((l) => /^\s+review:/.test(l));
  if (!reviewLine) throw new RulesError('rules.yml invalide : axes.review absent');
  const m = reviewLine.match(/review:\s*\[(.*)\]/);
  let axesReview;
  if (m) axesReview = parseList(m[1]);
  else {
    const start = axesBlock.indexOf(reviewLine);
    axesReview = [];
    for (const l of axesBlock.slice(start + 1)) {
      const it = l.match(/^\s+-\s*(\S+)/);
      if (it) axesReview.push(it[1]); else if (l.trim()) break;
    }
  }
  if (!axesReview.length) throw new RulesError('rules.yml invalide : axes.review vide');

  const th = topBlock(lines, 'thresholds');
  const thLine = th && th.find((l) => /^\s+security_confirmed_min_severity:/.test(l));
  if (!thLine) throw new RulesError('rules.yml invalide : thresholds.security_confirmed_min_severity absent');
  const minSeverity = thLine.split(':')[1].trim();
  if (!['low', 'medium', 'high', 'critical'].includes(minSeverity)) {
    throw new RulesError('rules.yml invalide : thresholds.security_confirmed_min_severity inconnu');
  }

  // security.access : none | fast | deep ; absent = fast (comportement de la phase 4)
  const sec = topBlock(lines, 'security');
  const accLine = sec && sec.find((l) => /^\s+access:/.test(l));
  const access = accLine ? accLine.split(':')[1].trim() : 'fast';
  if (!['none', 'fast', 'deep'].includes(access)) throw new RulesError('rules.yml invalide : security.access inconnu');

  // budgets.<mode>.max_minutes / max_tokens ; défauts des conventions
  const budgets = { fast: { max_minutes: 5, max_tokens: 80000 }, standard: { max_minutes: 15, max_tokens: 250000 }, deep: { max_minutes: 90, max_tokens: 1500000 } };
  const bb = topBlock(lines, 'budgets') || [];
  for (const l of bb) {
    const b = l.match(/^\s+(fast|standard|deep):\s*\{(.*)\}/);
    if (!b) continue;
    const mm = b[2].match(/max_minutes:\s*(\d+)/), mt = b[2].match(/max_tokens:\s*(\d+)/);
    if (mm) budgets[b[1]].max_minutes = Number(mm[1]);
    if (mt) budgets[b[1]].max_tokens = Number(mt[1]);
  }

  return {
    path: file,
    security_access: access,
    budgets,
    version: 1,
    axes_review: axesReview,
    security_confirmed_min_severity: minSeverity,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  };
}

module.exports = { loadRules, RulesError };

if (require.main === module) {
  const repo = path.resolve(process.argv[2] || '.');
  try {
    console.log(JSON.stringify(loadRules(repo), null, 2));
  } catch (e) {
    if (!(e instanceof RulesError)) throw e;
    console.error(e.message);
    process.exit(3);
  }
}

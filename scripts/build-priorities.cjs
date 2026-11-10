#!/usr/bin/env node
'use strict';
// Document de priorisation P1/P2/P3 à partir de findings.json.
// usage: build-priorities.cjs <dossier-sécurité> --target <repo>
//        ou require('./build-priorities.cjs').renderPriorities(findings, secDir, repo)
// Écrit <sec>/PRIORITIES.md. Les emplacements sont des liens markdown relatifs
// (fichier#Llignes) cliquables dans Cursor / VS Code / GitHub.
const fs = require('node:fs');
const path = require('node:path');

const KIND_P1 = new Set(['injection', 'secret', 'access-control', 'deserialization']);

/** Lien markdown relatif depuis le dossier sécurité vers file:line du dépôt. */
function locLink(secDir, repo, file, line) {
  const abs = path.resolve(repo, file);
  const rel = path.relative(secDir, abs).split(path.sep).join('/');
  return `[${file}:${line}](${rel}#L${line})`;
}

function primaryLoc(f) {
  const sink = Array.isArray(f.trace) && f.trace.find((t) => t && t.kind === 'sink');
  if (sink && sink.file && Number.isInteger(sink.line)) return { file: sink.file, line: sink.line };
  const e = Array.isArray(f.evidence) && f.evidence[0];
  if (e && e.file && Number.isInteger(e.line)) return { file: e.file, line: e.line };
  return null;
}

/** P1 critique · P2 important · P3 modéré. null = hors document (rejected). */
function priorityOf(f) {
  if (!f || f.verdict === 'rejected') return null;
  if (f.verdict === 'confirmed') {
    const s = f.severity && f.severity.overall_severity;
    if (s === 'critical' || s === 'high') return 'P1';
    if (s === 'medium') return 'P2';
    return 'P3';
  }
  // needs_validation : priorité provisoire (pas de severity dans le schéma)
  const m = typeof f.fingerprint === 'string' && f.fingerprint.match(/^fast-([a-z0-9-]+)-/);
  const kind = m ? m[1] : null;
  if (kind && KIND_P1.has(kind)) return 'P1';
  if (kind === 'cve') return 'P2';
  if (kind === 'other') return 'P3';
  return 'P2';
}

const SECTIONS = [
  ['P1', 'P1 — Critique', 'Corriger en premier (sévérité critical/high, ou piste injection / secret / contrôle d\'accès / désérialisation).'],
  ['P2', 'P2 — Important', 'Traiter ensuite (sévérité medium, CVE à valider, ou piste sans sévérité confirmée).'],
  ['P3', 'P3 — Modéré', 'Planifier (sévérité low/informational, ou autre piste à valider).']
];

function renderPriorities(findings, secDir, repo) {
  const list = Array.isArray(findings) ? findings : [];
  const buckets = { P1: [], P2: [], P3: [] };
  for (const f of list) {
    const p = priorityOf(f);
    if (p) buckets[p].push(f);
  }
  const n = (k) => list.filter((f) => f.verdict === k).length;
  const out = [
    '# Priorités des failles',
    '',
    `confirmed ${n('confirmed')} · needs_validation ${n('needs_validation')} · rejected ${n('rejected')}`,
    '',
    'Chaque emplacement est un lien cliquable vers la ligne concernée dans le dépôt.',
    'Les pistes `needs_validation` portent une priorité **provisoire** (pas encore de sévérité confirmée).',
    ''
  ];
  for (const [key, title, blurb] of SECTIONS) {
    out.push(`## ${title}`, '', blurb, '');
    const items = buckets[key];
    if (!items.length) {
      out.push('_Aucune._', '');
      continue;
    }
    for (const f of items) {
      const loc = primaryLoc(f);
      const link = loc ? locLink(secDir, repo, loc.file, loc.line) : '_emplacement inconnu_';
      const sev = f.verdict === 'confirmed' && f.severity
        ? f.severity.overall_severity
        : 'à valider';
      out.push(`- **${f.title}** — \`${f.fingerprint}\``);
      out.push(`  - priorité ${key} · verdict \`${f.verdict}\` · ${sev}`);
      out.push(`  - emplacement : ${link}`);
      const extras = Array.isArray(f.evidence) ? f.evidence : [];
      for (const e of extras) {
        if (loc && e.file === loc.file && e.line === loc.line) continue;
        out.push(`  - preuve : ${locLink(secDir, repo, e.file, e.line)} — ${e.description}`);
      }
      if (f.verdict === 'needs_validation' && Array.isArray(f.blockers) && f.blockers.length) {
        out.push(`  - bloqueur : ${f.blockers[0]}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

function writePriorities(secDir, repo, findings) {
  const md = renderPriorities(findings, secDir, repo);
  fs.writeFileSync(path.join(secDir, 'PRIORITIES.md'), md);
  return md;
}

module.exports = { renderPriorities, writePriorities, priorityOf, locLink, primaryLoc };

if (require.main === module) {
  const sec = path.resolve(process.argv[2] || '');
  const a = process.argv.slice(3);
  const i = a.indexOf('--target');
  const target = i >= 0 ? path.resolve(a[i + 1]) : '';
  if (!sec || !target) {
    console.error('usage: build-priorities.cjs <dossier-sécurité> --target <repo>');
    process.exit(3);
  }
  let findings;
  try { findings = JSON.parse(fs.readFileSync(path.join(sec, 'findings.json'), 'utf8')); }
  catch { console.error('findings.json illisible'); process.exit(3); }
  writePriorities(sec, target, findings);
  console.log(`PRIORITIES.md → ${path.join(sec, 'PRIORITIES.md')}`);
}

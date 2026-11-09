#!/usr/bin/env node
'use strict';
// Transforme la sortie brute des outils en findings de revue et en seeds sécurité.
// usage: parse-deterministic.cjs <context.json> <out-dir>
// Écrit review-findings.json et security-seeds.json. N'interprète aucune règle : mappe seulement.
const fs = require('node:fs');
const path = require('node:path');
const { validateFile } = require('./validate-review-findings.cjs');

const ctx = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const repo = ctx.repo.path;
const raw = (n) => { try { return fs.readFileSync(path.join(out, 'raw', n), 'utf8'); } catch { return null; } };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

const findings = [];
const seeds = [];
const seen = new Set();
function add(f) {
  let id = f.id, n = 2;
  while (seen.has(id)) id = `${f.id}-${n++}`;
  seen.add(id);
  findings.push({ ...f, id });
}
function lines(rel) { try { return fs.readFileSync(path.join(repo, rel), 'utf8').split('\n'); } catch { return []; } }

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'target', 'dist', 'build', '.review'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(path.relative(repo, p));
  }
  return acc;
}
let allFiles = null;
const files = () => (allFiles ||= walk(repo));

// --- ArchUnit -------------------------------------------------------------
function parseArchUnit(text) {
  const rows = text.split('\n');
  let rule = null;
  const seenKey = new Set();
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].match(/(?:ERROR\]\s+|^)(\w+)\.(\w+) -- Time elapsed.*(?:FAILURE|ERROR)/);
    if (t) { rule = t[2]; continue; }
    if (!rule) continue;
    const v = rows[i].match(/^(?:Constructor|Method|Field|Class|Constant|Static|Instance)\b[^<]*<([\w.$]+)[.<(][^>]*>.* in \((\w+\.java):(\d+)\)\s*$/);
    if (!v) continue;
    const fqn = v[1];
    const parts = fqn.split('.');
    const ci = parts.findIndex((p) => /^[A-Z]/.test(p));
    if (ci < 0) continue;
    const suffix = `${parts.slice(0, ci).join('/')}/${parts[ci].split('$')[0]}.java`;
    const file = files().find((f) => f.endsWith(suffix));
    if (!file) continue;
    let line = Number(v[3]);
    const src = lines(file);
    if (line < 1) {
      const tokens = (rows[i].match(/[a-z][\w]*(?:\.[\w$]+)+/g) || []).filter((x) => !fqn.startsWith(x) && !x.startsWith(parts.slice(0, ci).join('.')));
      const idx = src.findIndex((l) => /^\s*import\s/.test(l) && tokens.some((tk) => l.includes(tk.replace(/\.[a-z]\w*$/, '').split('(')[0]) || l.includes(tk)));
      line = idx >= 0 ? idx + 1 : 1;
    }
    const key = `${file}:${line}:${rule}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    add({
      id: `archunit:${slug(rule)}-${slug(path.basename(file, '.java'))}-${line}`,
      axis: 'architecture', severity: 'blocking', file, line,
      title: `Violation de la règle d'architecture ${rule}.`,
      evidence: (src[line - 1] || rows[i]).trim() || rows[i].trim(),
      rule, source: 'archunit'
    });
  }
}

// --- dependency-cruiser ---------------------------------------------------
function parseDepcruise(text) {
  let j;
  try { j = JSON.parse(text); } catch { return; }
  for (const v of (j.summary && j.summary.violations) || []) {
    const file = v.from;
    const src = lines(file);
    const target = v.unresolvedTo || v.to || '';
    const idx = src.findIndex((l) => /\b(import|from|require)\b/.test(l) && (l.includes(`"${target}"`) || l.includes(`'${target}'`) || l.includes(`/${target.split('/').pop().replace(/\.\w+$/, '')}"`) || l.includes(`/${target.split('/').pop().replace(/\.\w+$/, '')}'`)));
    const line = idx >= 0 ? idx + 1 : 1;
    const sev = v.rule.severity === 'error' ? 'blocking' : v.rule.severity === 'warn' ? 'fix' : 'suggestion';
    add({
      id: `dependency-cruiser:${slug(v.rule.name)}-${slug(path.basename(file))}-${line}`,
      axis: 'architecture', severity: sev, file, line,
      title: `Violation de la règle d'architecture ${v.rule.name}.`,
      evidence: (src[line - 1] || `${v.from} -> ${v.to}`).trim() || `${v.from} -> ${v.to}`,
      rule: v.rule.name, source: 'dependency-cruiser'
    });
  }
}

// --- Versions non épinglées ----------------------------------------------
function unpinned() {
  const pom = 'pom.xml';
  if (fs.existsSync(path.join(repo, pom))) {
    const src = lines(pom);
    src.forEach((l, i) => {
      const m = l.match(/<version>\s*([^<]+?)\s*<\/version>/);
      if (!m || !/^[\[(]|LATEST|RELEASE|,/.test(m[1]) || m[1].includes('${')) return;
      let name = 'dependance';
      for (let k = i; k >= 0 && k > i - 6; k--) { const a = src[k].match(/<artifactId>([^<]+)</); if (a) { name = a[1]; break; } }
      add({ id: `dependency-audit:unpinned-${slug(name)}`, axis: 'deterministic', severity: 'suggestion', file: pom, line: i + 1,
        title: `Version non épinglée pour ${name}.`, evidence: l.trim(), rule: 'dependency-pinning', source: 'dependency-audit' });
    });
  }
  for (const g of ['build.gradle', 'build.gradle.kts']) {
    lines(g).forEach((l, i) => {
      if (/['"][\w.-]+:[\w.-]+:[^'"]*(\+|latest\.\w+)[^'"]*['"]/.test(l)) {
        const name = (l.match(/['"][\w.-]+:([\w.-]+):/) || [, 'dependance'])[1];
        add({ id: `dependency-audit:unpinned-${slug(name)}`, axis: 'deterministic', severity: 'suggestion', file: g, line: i + 1,
          title: `Version non épinglée pour ${name}.`, evidence: l.trim(), rule: 'dependency-pinning', source: 'dependency-audit' });
      }
    });
  }
  if (fs.existsSync(path.join(repo, 'package.json'))) {
    const src = lines('package.json');
    let section = null;
    src.forEach((l, i) => {
      const s = l.match(/^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:\s*\{/);
      if (s) { section = s[1]; return; }
      if (section && /^\s*\}/.test(l)) { section = null; return; }
      const d = section && l.match(/^\s*"([^"]+)"\s*:\s*"([^"]*)"/);
      if (!d) return;
      const v = d[2];
      if (/^(\^|~|\*|>|<|x$|latest$)/.test(v) || /\|\||\sx?\s|\.x\b|^$/.test(v)) {
        add({ id: `dependency-audit:unpinned-${slug(d[1])}`, axis: 'deterministic', severity: 'suggestion', file: 'package.json', line: i + 1,
          title: `Version non épinglée pour ${d[1]}.`, evidence: l.trim().replace(/,$/, ''), rule: 'dependency-pinning', source: 'dependency-audit' });
      }
    });
  }
}

// --- CVE (npm audit) et secrets : seeds uniquement ------------------------
function parseNpmAudit(text) {
  let j;
  try { j = JSON.parse(text); } catch { return; }
  const lineOf = (pkg) => { const i = lines('package.json').findIndex((l) => l.includes(`"${pkg}"`)); return i >= 0 ? i + 1 : 1; };
  for (const [pkg, v] of Object.entries(j.vulnerabilities || {})) {
    const adv = (v.via || []).find((x) => typeof x === 'object');
    seeds.push({ file: 'package-lock.json', line: lineOf(pkg), title: adv ? adv.title : `Avis sur ${pkg}`, evidence: adv && adv.url ? adv.url : pkg });
  }
}
function parseGitleaks(text) {
  let j;
  try { j = JSON.parse(text); } catch { return; }
  for (const r of Array.isArray(j) ? j : []) {
    seeds.push({ file: r.File || 'diff.patch', line: r.StartLine || 1, title: r.Description || r.RuleID || 'fuite détectée', evidence: r.RuleID || 'gitleaks' });
  }
}

// --- Linter : seulement les règles citées par rules.yml -------------------
function parseLint(text) {
  let ids = [];
  try {
    const y = fs.readFileSync(path.join(repo, '.review', 'rules.yml'), 'utf8');
    ids = [...y.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1]);
  } catch { /* rien */ }
  if (!ids.length) return;
  for (const row of text.split('\n')) {
    const m = row.match(/^(.+?):(\d+)(?::\d+)?\s.*\b([\w-]+)\s*$/);
    if (!m || !ids.includes(m[3])) continue;
    const file = path.relative(repo, path.resolve(repo, m[1]));
    if (file.startsWith('..')) continue;
    add({ id: `linter:${slug(m[3])}-${slug(path.basename(file))}-${m[2]}`, axis: 'naming', severity: 'fix', file, line: Number(m[2]),
      title: `Règle ${m[3]} non respectée.`, evidence: row.trim(), rule: m[3], source: 'linter' });
  }
}

let t;
if ((t = raw('archunit.txt'))) parseArchUnit(t);
if ((t = raw('depcruise.json'))) parseDepcruise(t);
unpinned();
if ((t = raw('npm-audit.json'))) parseNpmAudit(t);
if ((t = raw('gitleaks.json'))) parseGitleaks(t);
if ((t = raw('lint.txt'))) parseLint(t);

const errs = validateFile(findings);
if (errs.length) { console.error('findings déterministes invalides :\n' + errs.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(out, 'review-findings.json'), JSON.stringify(findings, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'security-seeds.json'), JSON.stringify(seeds, null, 2) + '\n');
console.log(`déterministe : ${findings.length} findings, ${seeds.length} seeds`);

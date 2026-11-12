#!/usr/bin/env node
'use strict';
// Pipeline sécurité fast : outils déterministes autour des deux agents (chasseur, vérificateur).
//   prepare <run-de-revue> <dossier-sécurité>        meta.json, seed-candidates.json, hunter.prompt.md
//   save-candidates <dossier-sécurité>               stdin : tableau JSON du chasseur -> candidates.json
//   verifier-prompts <dossier-sécurité>              verify/<n>.prompt.md (candidat seul, jamais le chasseur)
//   save-verdict <dossier-sécurité> <n>              stdin : verdict JSON -> verify/<n>.verdict.json
//   add-hints <run-de-revue> <dossier-sécurité>      seconde passe : cross-hints.json -> candidats hint
//   finalize <dossier-sécurité> --target <repo> [--threshold high] [--budget-exhausted]
//       findings.json (schéma Cloudflare), validation, REPORT.md, FINDINGS-DETAIL.md, NEEDS-VALIDATION.md, PRIORITIES.md, summary.json
// Codes : 0 ok ; 1 un confirmed atteint le seuil ; 2 échec définitif ; 3 configuration ; 4 validation refusée,
// une réécriture permise (corriger les verdicts, relancer finalize une fois).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validate, safeRel } = require('./validate-security.cjs');
const { writePriorities, locLink } = require('./build-priorities.cjs');
const { resolveSandbox } = require('./sandbox-status.cjs');
const { finalizeUsage } = require('./usage-metrics.cjs');

const KINDS = ['injection', 'deserialization', 'secret', 'access-control', 'cve', 'other'];
const SEV = { low: 1, medium: 2, high: 3, critical: 4 };
const BLOCKER_SANDBOX = 'Sandbox bloqué (CODE_CHECK_SANDBOX=off) : pas de confirmed.';
const BLOCKER_HINT = 'Indice venu de la revue de code, non vérifié.';
const SCORE = new Set(['informational', 'low', 'medium', 'high', 'critical']);

function readSandbox(secDir) {
  const p = readJson(path.join(secDir, 'prereqs.json'), {});
  return p.sandbox !== 'absent';
}

function completeConfirmed(v) {
  if (!v || v.verdict !== 'confirmed') return false;
  if (!nonEmpty(v.root_cause) || !nonEmpty(v.intended_behavior)) return false;
  if (!Array.isArray(v.conditions)) return false;
  const ex = v.execution, rem = v.remediation, sev = v.severity, conf = v.confidence;
  if (!ex || !nonEmpty(ex.attacker_perspective) || !Array.isArray(ex.payloads) || !Array.isArray(ex.instructions) || !nonEmpty(ex.observed_result)) return false;
  if (!rem || !nonEmpty(rem.strategy)) return false;
  if (!sev || !sev.likelihood || !sev.impact || !SCORE.has(sev.overall_severity)) return false;
  if (!SCORE.has(sev.likelihood.score) || !nonEmpty(sev.likelihood.reason)) return false;
  if (!SCORE.has(sev.impact.score) || !nonEmpty(sev.impact.reason)) return false;
  if (!conf || !SCORE.has(conf.score) || !nonEmpty(conf.reason)) return false;
  return true;
}

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const stdin = () => fs.readFileSync(0, 'utf8');
const die = (m, c = 3) => { console.error(m); process.exit(c); };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

function lineOf(repo, file, line) {
  if (!safeRel(file)) return null;
  let root, real;
  try { root = fs.realpathSync(repo); real = fs.realpathSync(path.join(root, file)); } catch { return null; }
  if (!real.startsWith(root + path.sep)) return null;
  const lines = fs.readFileSync(real, 'utf8').split('\n');
  return { text: lines[line - 1], count: lines.length };
}

function checkCandidate(c, repo) {
  if (!c || typeof c !== 'object') return 'objet attendu';
  if (!KINDS.includes(c.kind)) return `kind invalide (${KINDS.join('|')})`;
  if (!nonEmpty(c.title) || !nonEmpty(c.claim)) return 'title et claim requis';
  if (!safeRel(c.file) || !Number.isInteger(c.line) || c.line < 1) return 'file/line invalides';
  if (!nonEmpty(c.quote) || c.quote.includes('\n')) return 'quote requise, sur une seule ligne';
  const l = lineOf(repo, c.file, c.line);
  if (!l || l.text === undefined) return 'file:line absent du dépôt';
  if (!l.text.includes(c.quote.trim())) return 'quote absente de la ligne citée';
  return null;
}

function goodTrace(tr, repo) {
  return Array.isArray(tr) && tr.length > 0 && tr.every((t) => t && ['entrypoint', 'propagation', 'sink'].includes(t.kind) && nonEmpty(t.scope) && nonEmpty(t.description) && Number.isInteger(t.line) && t.line >= 1 && (() => { const l = lineOf(repo, t.file, t.line); return l && l.text !== undefined; })());
}

function cand(o) { return { origin: 'hunter', ...o }; }

// --- prepare -------------------------------------------------------------
function prepare(runDir, secDir) {
  const ctx = readJson(path.join(runDir, 'context.json'));
  if (!ctx) die('context.json manquant');
  const repo = ctx.repo.path;
  fs.mkdirSync(secDir, { recursive: true });
  const meta = { run_id: ctx.run_id, review_run: runDir, repo, repo_name: ctx.repo.name };
  const seeds = readJson(path.join(runDir, 'deterministic', 'security-seeds.json'), []);
  const hints = readJson(path.join(runDir, 'cross-hints.json'), []);
  const out = [];
  let unresolved = 0;
  const push = (o, origin) => {
    const l = lineOf(repo, o.file, o.line);
    if (!l) { unresolved++; return; }
    const line = l.text === undefined ? l.count : o.line;
    const text = (l.text === undefined ? '' : l.text).trim() || '(ligne vide)';
    out.push(cand({ origin, kind: o.kind, title: o.title, claim: o.claim, file: o.file, line, quote: text }));
  };
  for (const s of Array.isArray(seeds) ? seeds : []) {
    const secret = /secret|fuite|gitleaks|token|jeton|cl[ée]|identifiant/i.test(`${s.title} ${s.evidence}`);
    push({ kind: secret ? 'secret' : 'cve', file: s.file, line: s.line, title: s.title, claim: `Seed déterministe : ${s.title} (${s.evidence}).` }, 'seed');
  }
  for (const h of Array.isArray(hints) ? hints : []) {
    const note = h.title || h.note || 'indice de sécurité';
    push({ kind: 'other', file: h.file, line: h.line, title: note, claim: `Indice de la revue de code : ${note}` }, 'hint');
  }
  meta.cross_hints = out.filter((c) => c.origin === 'hint').length;
  meta.cross_hints_unresolved = unresolved;
  const sandbox = resolveSandbox();
  writeJson(path.join(secDir, 'meta.json'), meta);
  writeJson(path.join(secDir, 'prereqs.json'), {
    node: process.version,
    validators: 'ok',
    subagents: 'assumed',
    sandbox
  });
  writeJson(path.join(secDir, 'seed-candidates.json'), out);
  const has = (f) => fs.existsSync(path.join(runDir, f));
  const lines = [
    '# Chasseur sécurité (mode fast)', '',
    'Procédure : `agents/security/fast.md`, section Chasseur. Entrées, et rien d\'autre :', '',
    `- contexte : ${path.join(runDir, 'context.json')}`,
    `- diff : ${path.join(runDir, 'diff.patch')}`,
    has('deterministic/security-seeds.json') ? `- seeds : ${path.join(runDir, 'deterministic', 'security-seeds.json')}` : null,
    has('cross-hints.json') ? `- indices de la revue : ${path.join(runDir, 'cross-hints.json')}` : null,
    '', `Dépôt cible : ${repo}`,
    'Les seeds et indices deviennent des candidats sans toi. Ne les répète pas : cherche ce qu\'ils ne couvrent pas.',
    'Réponse : un tableau JSON de candidats, aucune prose.', ''
  ].filter((x) => x !== null);
  fs.writeFileSync(path.join(secDir, 'hunter.prompt.md'), lines.join('\n'));
  console.log(`prepare : ${out.length} candidats venus des seeds et indices, ${unresolved} non retrouvés`);
}

// --- add-hints : seconde passe, uniquement les pistes de la revue -----------
function addHints(runDir, secDir) {
  const meta = readJson(path.join(secDir, 'meta.json'));
  const cands = readJson(path.join(secDir, 'candidates.json'), []);
  if (!meta) die('meta.json manquant : lancer prepare');
  const hints = readJson(path.join(runDir, 'cross-hints.json'), []);
  const seen = new Set(cands.map((c) => `${c.file}:${c.line}`));
  const added = [];
  let unresolved = 0;
  for (const h of Array.isArray(hints) ? hints : []) {
    const l = lineOf(meta.repo, h.file, h.line);
    if (!l) { unresolved++; continue; }
    const line = l.text === undefined ? l.count : h.line;
    if (seen.has(`${h.file}:${line}`)) continue;
    seen.add(`${h.file}:${line}`);
    const note = h.title || h.note || 'indice de sécurité';
    const c = cand({ origin: 'hint', kind: 'other', title: note, claim: `Indice de la revue de code : ${note}`, file: h.file, line, quote: (l.text === undefined ? '' : l.text).trim() || '(ligne vide)', n: cands.length + 1 });
    cands.push(c); added.push(c.n);
  }
  meta.cross_hints = cands.filter((c) => c.origin === 'hint').length;
  meta.cross_hints_unresolved = (meta.cross_hints_unresolved || 0) + unresolved;
  writeJson(path.join(secDir, 'meta.json'), meta);
  writeJson(path.join(secDir, 'candidates.json'), cands);
  console.log(`pistes ajoutées : ${added.length} (${added.join(',')})`);
}

// --- save-candidates -----------------------------------------------------
function saveCandidates(secDir) {
  const meta = readJson(path.join(secDir, 'meta.json'));
  if (!meta) die('meta.json manquant : lancer prepare');
  let raw;
  try { raw = JSON.parse(stdin()); } catch { die('JSON du chasseur illisible', 2); }
  if (!Array.isArray(raw)) die('tableau JSON attendu', 2);
  const all = readJson(path.join(secDir, 'seed-candidates.json'), []);
  const seen = new Set(all.map((c) => `${c.file}:${c.line}`));
  let dropped = 0;
  for (const c of raw) {
    const err = checkCandidate(c, meta.repo);
    const key = c && `${c.file}:${c.line}`;
    if (err || seen.has(key)) { dropped++; if (err) console.error(`écarté : ${err}`); continue; }
    seen.add(key);
    // trace inventée (ligne ou fichier absent) : abandonnée en entier, le writer retombe sur le puits seul
    const okTrace = goodTrace(c.trace, meta.repo);
    if (Array.isArray(c.trace) && !okTrace) console.error('trace écartée : fichier ou ligne introuvable');
    all.push(cand({ kind: c.kind, title: c.title, claim: c.claim, file: c.file, line: c.line, quote: c.quote.trim(), ...(okTrace ? { trace: c.trace } : {}) }));
  }
  all.forEach((c, i) => { c.n = i + 1; });
  writeJson(path.join(secDir, 'candidates.json'), all);
  console.log(`candidats : ${all.length} (${dropped} écartés)`);
}

// --- verifier-prompts ----------------------------------------------------
function verifierPrompts(secDir) {
  const meta = readJson(path.join(secDir, 'meta.json'));
  const cands = readJson(path.join(secDir, 'candidates.json'));
  if (!meta || !cands) die('candidates.json manquant');
  fs.mkdirSync(path.join(secDir, 'verify'), { recursive: true });
  for (const c of cands) {
    const body = [
      '# Vérificateur sécurité (mode fast)', '',
      'Procédure : `agents/security/fast.md`, section Vérificateur. Tu ne vois pas le raisonnement du chasseur : seulement ce candidat.', '',
      `Dépôt cible : ${meta.repo}`,
      `Diff : ${path.join(meta.review_run, 'diff.patch')}`, '',
      'Candidat :', '```json', JSON.stringify({ kind: c.kind, origin: c.origin, title: c.title, claim: c.claim, file: c.file, line: c.line, quote: c.quote }, null, 2), '```',
      c.origin === 'hint' ? '\nOrigine : indice venu de la revue de code, non vérifié. Un indice non retrouvé dans le code est `rejected`.' : '',
      '\nRéponse : un objet JSON, aucune prose.', ''
    ];
    fs.writeFileSync(path.join(secDir, 'verify', `${c.n}.prompt.md`), body.join('\n'));
  }
  console.log(`prompts vérificateur : ${cands.length}`);
}

// --- save-verdict --------------------------------------------------------
function saveVerdict(secDir, n) {
  let v;
  try { v = JSON.parse(stdin()); } catch { die('verdict illisible', 2); }
  if (!v || !['needs_validation', 'rejected', 'confirmed'].includes(v.verdict)) die('verdict invalide', 2);
  if (v.verdict === 'rejected' && !nonEmpty(v.reason)) die('rejected sans reason', 2);
  fs.mkdirSync(path.join(secDir, 'verify'), { recursive: true });
  if (v.trace !== undefined) {
    const meta = readJson(path.join(secDir, 'meta.json'));
    if (!meta || !goodTrace(v.trace, meta.repo)) { console.error('trace écartée : fichier ou ligne introuvable'); delete v.trace; }
  }
  writeJson(path.join(secDir, 'verify', `${n}.verdict.json`), v);
  console.log(`verdict ${n} enregistré`);
}

// --- finalize ------------------------------------------------------------
function build(c, v, budgetOut, sandboxOn) {
  const fingerprint = `fast-${c.kind}-${sha(`${c.file}\n${c.quote}`).slice(0, 12)}`;
  const origin = c.origin === 'hunter' ? 'chasseur' : c.origin === 'seed' ? 'seed déterministe' : 'indice de la revue';
  const trace = Array.isArray(v && v.trace) && v.trace.length ? v.trace : Array.isArray(c.trace) && c.trace.length ? c.trace
    : [{ kind: 'sink', file: c.file, line: c.line, scope: 'diff du run (mode fast)', description: c.claim }];
  const evidence = [{ file: c.file, line: c.line, description: `Citation : ${c.quote}` }];
  const description = `${c.claim} Origine : ${origin}.`;
  if (v && v.verdict === 'rejected') {
    return {
      verdict: 'rejected', fingerprint, title: c.title, description,
      claimed_root_cause: nonEmpty(v.root_cause) ? v.root_cause : c.claim,
      trace, evidence, reason: v.reason
    };
  }
  if (sandboxOn && completeConfirmed(v)) {
    return {
      verdict: 'confirmed', fingerprint, title: c.title, description,
      root_cause: v.root_cause, intended_behavior: v.intended_behavior,
      trace, evidence, conditions: v.conditions,
      execution: v.execution, remediation: v.remediation,
      severity: v.severity, confidence: v.confidence
    };
  }
  const blockers = [];
  if (nonEmpty(v && v.blocker)) blockers.push(v.blocker);
  else if (!v) blockers.push(budgetOut && c.origin === 'hint' ? 'Budget atteint avant vérification.' : 'Vérification indépendante non réalisée.');
  if (c.origin === 'hint') blockers.push(BLOCKER_HINT);
  if (!sandboxOn) blockers.push(BLOCKER_SANDBOX);
  else if (v && v.verdict === 'confirmed') blockers.push('Verdict confirmed incomplet : champs Cloudflare manquants.');
  const plan = (v && v.validation_plan) || {};
  const validation_plan = {};
  validation_plan.local = nonEmpty(plan.local) ? plan.local : "Rejouer l'entrée contrôlée sur le chemin cité, dans un bac à sable, et observer le résultat.";
  if (nonEmpty(plan.deployment)) validation_plan.deployment = plan.deployment;
  return {
    verdict: 'needs_validation', fingerprint, title: c.title, description,
    claimed_root_cause: nonEmpty(v && v.root_cause) ? v.root_cause : c.claim,
    trace, evidence, blockers: [...new Set(blockers)], validation_plan
  };
}

function md(findings, secDir, repo) {
  const by = (k) => findings.filter((f) => f.verdict === k);
  const nv = by('needs_validation'), cf = by('confirmed');
  const link = (e) => locLink(secDir, repo, e.file, e.line);
  const list = (a) => a.map((f) => `- \`${f.fingerprint}\` — ${f.title} (${link(f.evidence[0])})`).join('\n') || '- aucune';
  const report = ['# Rapport sécurité (mode fast)', '',
    `confirmed : ${cf.length} · needs_validation : ${nv.length} · rejected : ${by('rejected').length}`, '',
    '## Confirmés', list(cf), '', '## À valider', list(nv), '',
    'Priorisation P1/P2/P3 : `PRIORITIES.md`. Détail des pistes : `NEEDS-VALIDATION.md`. Sandbox bloqué → jamais de confirmed.', ''].join('\n');
  const detail = ['# Détail des findings', '', ...findings.flatMap((f) => [
    `## ${f.title}`, `- fingerprint : \`${f.fingerprint}\``, `- verdict : ${f.verdict}`, `- description : ${f.description}`,
    `- cause : ${f.claimed_root_cause || f.root_cause}`,
    ...f.evidence.map((e) => `- preuve : ${link(e)} — ${e.description}`),
    ...(f.reason ? [`- raison du rejet : ${f.reason}`] : []), ''])].join('\n');
  const needs = ['# Pistes à valider', '', ...nv.flatMap((f) => [
    `## ${f.title}`, `- ${link(f.evidence[0])}`,
    ...f.blockers.map((b) => `- bloqueur : ${b}`),
    `- plan local : ${f.validation_plan.local}`, ...(f.validation_plan.deployment ? [`- plan de déploiement : ${f.validation_plan.deployment}`] : []), ''])].join('\n');
  return { report, detail, needs };
}

function finalize(secDir, target, threshold, budgetOut) {
  const meta = readJson(path.join(secDir, 'meta.json'));
  const cands = readJson(path.join(secDir, 'candidates.json'), []);
  if (!meta) die('meta.json manquant : lancer prepare');
  const sandboxOn = readSandbox(secDir);
  const attemptsFile = path.join(secDir, 'finalize.attempts');
  const attempts = (Number(fs.existsSync(attemptsFile) ? fs.readFileSync(attemptsFile, 'utf8') : 0) || 0) + 1;
  fs.writeFileSync(attemptsFile, String(attempts));
  const byFp = new Map();
  for (const c of cands) {
    const v = readJson(path.join(secDir, 'verify', `${c.n}.verdict.json`));
    const f = build(c, v, budgetOut, sandboxOn);
    if (!byFp.has(f.fingerprint)) byFp.set(f.fingerprint, f);
  }
  const findings = [...byFp.values()].sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1));
  const file = path.join(secDir, 'findings.json');
  writeJson(file, findings);
  const errs = validate(file, target, { allowConfirmed: sandboxOn });
  const count = (k) => findings.filter((f) => f.verdict === k).length;
  const summary = { confirmed: count('confirmed'), needs_validation: count('needs_validation'), rejected: count('rejected'), cross_hints: meta.cross_hints || 0, status: 'ok' };
  if (errs.length) {
    for (const e of errs) console.error('ERROR:', e);
    for (const n of ['REPORT.md', 'FINDINGS-DETAIL.md', 'NEEDS-VALIDATION.md', 'PRIORITIES.md']) fs.rmSync(path.join(secDir, n), { force: true });
    if (attempts < 2) { console.error('validation refusée : corriger les verdicts et relancer finalize une fois.'); process.exit(4); }
    fs.renameSync(file, path.join(secDir, 'findings.invalid.json'));
    writeJson(path.join(secDir, 'summary.json'), { confirmed: 0, needs_validation: 0, rejected: 0, cross_hints: summary.cross_hints, status: 'failed' });
    console.log(`sécurité : échec de validation. Dossier : ${secDir}`);
    fs.writeFileSync(path.join(secDir, 'exit-code'), '2');
    process.exit(2);
  }
  fs.rmSync(attemptsFile, { force: true });
  const m = md(findings, secDir, target);
  fs.writeFileSync(path.join(secDir, 'REPORT.md'), m.report);
  fs.writeFileSync(path.join(secDir, 'FINDINGS-DETAIL.md'), m.detail);
  fs.writeFileSync(path.join(secDir, 'NEEDS-VALIDATION.md'), m.needs);
  writePriorities(secDir, target, findings);
  writeJson(path.join(secDir, 'summary.json'), summary);
  console.log(`sécurité : confirmed ${summary.confirmed} · needs_validation ${summary.needs_validation} · rejected ${summary.rejected} · pistes croisées ${summary.cross_hints}${sandboxOn ? '' : ' · sandbox absent (pas de confirmed)'}`);
  console.log(`Dossier : ${secDir}`);
  if (meta.review_run) {
    const ctx = readJson(path.join(meta.review_run, 'context.json'), {});
    const { lines: metricLines } = finalizeUsage(meta.review_run, ctx.created_at);
    for (const line of metricLines) console.log(line);
  }
  const min = SEV[threshold] || SEV.high;
  const hit = findings.some((f) => f.verdict === 'confirmed' && (SEV[f.severity && f.severity.overall_severity] || 0) >= min);
  fs.writeFileSync(path.join(secDir, 'exit-code'), hit ? '1' : '0');
  process.exit(hit ? 1 : 0);
}

const [cmd, a, b] = process.argv.slice(2);
const rest = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
if (cmd === 'prepare' && a && b) prepare(path.resolve(a), path.resolve(b));
else if (cmd === 'add-hints' && a && b) addHints(path.resolve(a), path.resolve(b));
else if (cmd === 'save-candidates' && a) saveCandidates(path.resolve(a));
else if (cmd === 'verifier-prompts' && a) verifierPrompts(path.resolve(a));
else if (cmd === 'save-verdict' && a && b) saveVerdict(path.resolve(a), b);
else if (cmd === 'finalize' && a && opt('--target')) finalize(path.resolve(a), path.resolve(opt('--target')), opt('--threshold'), rest.includes('--budget-exhausted'));
else die('usage: security-fast.cjs prepare|save-candidates|verifier-prompts|save-verdict|finalize ...');

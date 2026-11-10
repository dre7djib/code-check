#!/usr/bin/env node
'use strict';
// scoping : git + détection de fichiers. Aucun appel de modèle.
// usage: scope.cjs <repo> [--command review] [--host mistral|copilot|claude|cursor]
// stdout : chemin du dossier de run. Code 3 si configuration invalide (aucun dossier créé).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadRules, RulesError } = require('./load-rules.cjs');

const HOSTS = ['mistral', 'copilot', 'claude', 'cursor'];
const fail = (msg) => { console.error(msg); process.exit(3); };

function git(repo, args, opts = {}) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...opts });
}
const gitOk = (repo, args) => { try { git(repo, args); return true; } catch { return false; } };

function resolveHost(flag) {
  const env = process.env.CODE_CHECK_HOST;
  if (env) { if (!HOSTS.includes(env)) fail(`CODE_CHECK_HOST inconnu : ${env}`); return env; }
  if (flag) { if (!HOSTS.includes(flag)) fail(`hôte inconnu : ${flag}`); return flag; }
  const e = process.env;
  if (e.CLAUDECODE || e.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (e.CURSOR_TRACE_ID || e.CURSOR_AGENT) return 'cursor';
  if (e.VIBE_HOME) return 'mistral';
  return fail('hôte indéterminé : poser CODE_CHECK_HOST (mistral, copilot, claude, cursor)');
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const repo = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || '.');
  const command = opt('--command') || 'review';

  let rules;
  try { rules = loadRules(repo); } catch (e) { if (e instanceof RulesError) fail(e.message); throw e; }
  if (!gitOk(repo, ['rev-parse', '--git-dir'])) fail('pas un dépôt git');
  const host = resolveHost(opt('--host'));

  const hasHead = gitOk(repo, ['rev-parse', '--verify', 'HEAD']);
  const head = hasHead ? git(repo, ['rev-parse', 'HEAD']).trim() : '0'.repeat(40);
  let base;
  if (gitOk(repo, ['rev-parse', '--verify', 'main'])) base = 'main';
  else if (gitOk(repo, ['rev-parse', '--verify', 'master'])) base = 'master';
  else if (gitOk(repo, ['rev-parse', '--verify', 'HEAD~1'])) base = 'HEAD~1';
  else base = 'HEAD';

  const ahead = hasHead && base !== 'HEAD' && Number(git(repo, ['rev-list', '--count', `${base}..HEAD`]).trim()) > 0;
  const range = ahead ? `${base}...HEAD` : 'working-tree';
  const patch = ahead ? git(repo, ['diff', `${base}...HEAD`]) : (hasHead ? git(repo, ['diff', 'HEAD']) : git(repo, ['diff']));

  const files = [];
  let changed = 0;
  for (const l of patch.split('\n')) {
    if (l.startsWith('+++ ')) { const f = l.slice(4); if (f !== '/dev/null') { const g = f.replace(/^b\//, ''); if (!files.includes(g)) files.push(g); } }
    else if (l.startsWith('--- ')) { if (l.slice(4) !== '/dev/null') { const f = l.slice(4).replace(/^a\//, ''); if (!files.includes(f)) files.push(f); } }
    else if ((l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---')) changed++;
  }
  const touchesReview = files.some((f) => f === '.review' || f.startsWith('.review/'));
  const mode = (command === 'security-deep' || command === 'check-deep') ? 'deep'
    : changed <= 200 && !touchesReview ? 'fast' : 'standard';

  const stack = [];
  const has = (f) => fs.existsSync(path.join(repo, f));
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) stack.push('java');
  if (has('package.json')) stack.push('node');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const runId = `${ts}-${head.slice(0, 12)}`;
  const runDir = path.join(repo, '.review', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });

  const context = {
    run_id: runId,
    command,
    mode,
    host,
    repo: { name: path.basename(repo), path: repo, head },
    stack,
    diff: { base, range, changed_lines: changed, files, touches_review_dir: touchesReview },
    axes: rules.axes_review,
    security_access: rules.security_access,
    budget: rules.budgets[mode],
    rules_sha256: rules.sha256,
    created_at: now.toISOString()
  };
  fs.writeFileSync(path.join(runDir, 'diff.patch'), patch);
  fs.writeFileSync(path.join(runDir, 'context.json'), JSON.stringify(context, null, 2) + '\n');
  console.log(runDir);
}
main();

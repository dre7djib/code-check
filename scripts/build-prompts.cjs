#!/usr/bin/env node
'use strict';
// Construit le message de chaque reviewer et l'archive dans audit/trace/<axe>.prompt.md.
// usage: build-prompts.cjs <dossier-de-run> [--rules full|compact]
// full    : rules.yml intégral, inline.
// compact : audit/rules.compact.txt (Caveman, écrit par l'orchestrateur) + le bloc `architecture:`
//           de rules.yml, recopié tel quel. Les couches ne passent jamais par la compression.
// Le message contient les chemins context.json, diff.patch, sortie, et les règles. Rien d'autre.
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const runDir = path.resolve(args.find((a) => !a.startsWith('--')) || '');
const mode = (args.includes('--rules') ? args[args.indexOf('--rules') + 1] : 'full');
if (!['full', 'compact'].includes(mode)) { console.error('--rules full|compact'); process.exit(3); }

let ctx;
try { ctx = JSON.parse(fs.readFileSync(path.join(runDir, 'context.json'), 'utf8')); } catch { console.error('context.json illisible'); process.exit(3); }
const rulesPath = path.join(ctx.repo.path, '.review', 'rules.yml');
const rules = fs.readFileSync(rulesPath, 'utf8');

function architectureBlock(text) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith('architecture:'));
  if (i < 0) return '';
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j].trim() === '' || /^\s/.test(lines[j])) out.push(lines[j]); else break;
  }
  return out.join('\n').trimEnd();
}

let rulesPayload;
if (mode === 'full') {
  rulesPayload = `Règles (rules.yml, intégral) :\n\n${rules.trimEnd()}`;
} else {
  let compact;
  try { compact = fs.readFileSync(path.join(runDir, 'audit', 'rules.compact.txt'), 'utf8').trimEnd(); }
  catch { console.error('audit/rules.compact.txt manquant : le produire avec la skill caveman avant --rules compact'); process.exit(1); }
  rulesPayload = `Règles, hors couches (résumé compact) :\n\n${compact}\n\nCouches (rules.yml, recopiées telles quelles) :\n\n${architectureBlock(rules)}`;
}

const outDir = path.join(runDir, 'audit', 'trace');
fs.mkdirSync(outDir, { recursive: true });
let total = 0;
for (const axis of ctx.axes) {
  const out = path.join(runDir, 'audit', 'findings', `${axis}.json`);
  const msg = [
    `Axe : ${axis}`,
    `Contexte : ${path.join(runDir, 'context.json')}`,
    `Diff : ${path.join(runDir, 'diff.patch')}`,
    `Sortie (tu ne l'écris pas, tu renvoies le JSON) : ${out}`,
    `Repo : ${ctx.repo.path}`,
    '',
    rulesPayload,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, `${axis}.prompt.md`), msg);
  total += msg.length;
}
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ rules: mode, rules_chars: rulesPayload.length, total_chars: total }, null, 2) + '\n');
console.log(`prompts (${mode}) : ${ctx.axes.length} axes, ${total} caractères`);

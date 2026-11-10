#!/usr/bin/env node
'use strict';
// Enregistre la sortie d'un reviewer (stdin) dans audit/findings/<axe>.json.
// usage: save-findings.cjs <axe> <dossier-de-run>   (JSON sur stdin, fences markdown tolérées)
// simplicity : tableau, ou objet { findings: [...], hints: [{file,line,note}] }.
// Le reviewer n'a pas d'outil d'écriture : l'orchestrateur appelle ce script. Code 1 si JSON illisible.
const fs = require('node:fs');
const path = require('node:path');
const AXES = ['architecture', 'naming', 'tests', 'errors', 'simplicity'];
const [axis, runDir] = process.argv.slice(2);
if (!AXES.includes(axis) || !runDir) { console.error('usage: save-findings.cjs <architecture|naming|tests|errors|simplicity> <run-dir>'); process.exit(3); }
let text = fs.readFileSync(0, 'utf8').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
let data;
try { data = JSON.parse(text); } catch (e) { console.error(`JSON illisible pour ${axis} : ${e.message}`); process.exit(1); }
// Axe simplicity : objet { findings, hints } toléré. Les hints (pistes sécurité) vont dans
// simplicity-hints.json, jamais dans un rapport de revue.
let hints = null;
if (axis === 'simplicity' && data && !Array.isArray(data) && typeof data === 'object') {
  hints = Array.isArray(data.hints) ? data.hints : [];
  data = data.findings;
}
if (!Array.isArray(data)) { console.error(`tableau attendu pour ${axis}`); process.exit(1); }
const dir = path.join(path.resolve(runDir), 'audit', 'findings');
fs.mkdirSync(dir, { recursive: true });
if (hints) fs.writeFileSync(path.join(dir, 'simplicity-hints.json'), JSON.stringify(hints, null, 2) + '\n');
fs.writeFileSync(path.join(dir, `${axis}.json`), JSON.stringify(data, null, 2) + '\n');
console.log(`${axis} : ${data.length} entrées`);

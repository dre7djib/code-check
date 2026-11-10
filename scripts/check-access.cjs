#!/usr/bin/env node
'use strict';
// usage: check-access.cjs <repo> <review|security|check|security-deep|check-deep>
// Politique du repo (security.access de rules.yml), pas un verrou par personne.
// review ignore la clé. security et check exigent fast ou deep.
// security-deep et check-deep exigent deep.
// Code 0 : autorisé. Code 3 : message sur stderr, rien n'a démarré.
const path = require('node:path');
const { loadRules, RulesError } = require('./load-rules.cjs');
const CMDS = ['review', 'security', 'check', 'security-deep', 'check-deep'];
const DEEP = new Set(['security-deep', 'check-deep']);
const [repo, cmd] = [path.resolve(process.argv[2] || '.'), process.argv[3]];
if (!CMDS.includes(cmd)) { console.error(`usage: check-access.cjs <repo> <${CMDS.join('|')}>`); process.exit(3); }
let rules;
try { rules = loadRules(repo); } catch (e) { if (e instanceof RulesError) { console.error(e.message); process.exit(3); } throw e; }
const a = rules.security_access;
if (cmd === 'review') process.exit(0);
if (DEEP.has(cmd) ? a !== 'deep' : a === 'none') {
  console.error(DEEP.has(cmd)
    ? `security.access de rules.yml doit valoir deep pour ${cmd}`
    : 'sécurité désactivée par rules.yml (security.access: none)');
  process.exit(3);
}
process.exit(0);

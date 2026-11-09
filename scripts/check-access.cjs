#!/usr/bin/env node
'use strict';
// usage: check-access.cjs <repo> <review|security|check|security-deep>
// Politique du repo (security.access de rules.yml), pas un verrou par personne.
// review ignore la clé. security et check exigent fast ou deep. security-deep exige deep.
// Code 0 : autorisé. Code 3 : message sur stderr, rien n'a démarré.
const path = require('node:path');
const { loadRules, RulesError } = require('./load-rules.cjs');
const [repo, cmd] = [path.resolve(process.argv[2] || '.'), process.argv[3]];
if (!['review', 'security', 'check', 'security-deep'].includes(cmd)) { console.error('usage: check-access.cjs <repo> <review|security|check|security-deep>'); process.exit(3); }
let rules;
try { rules = loadRules(repo); } catch (e) { if (e instanceof RulesError) { console.error(e.message); process.exit(3); } throw e; }
const a = rules.security_access;
if (cmd === 'review') process.exit(0);
if (cmd === 'security-deep' ? a !== 'deep' : a === 'none') {
  console.error(cmd === 'security-deep' ? 'security.access de rules.yml doit valoir deep pour security-deep' : 'sécurité désactivée par rules.yml (security.access: none)');
  process.exit(3);
}
process.exit(0);

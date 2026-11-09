#!/usr/bin/env node
'use strict';
// Détecteur de secrets intégré, sans dépendance ni outil externe (gitleaks facultatif).
// usage: scan-secrets.cjs <diff.patch> <sortie.json>
// Lit les seules lignes ajoutées du diff. Écrit un tableau [{File, StartLine, RuleID, Description}]
// (même forme que gitleaks). Ne recopie jamais la valeur du secret dans la sortie.
const fs = require('node:fs');

const RULES = [
  ['aws-access-key', "Clé d'accès AWS", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private-key', 'Clé privée', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ['github-token', 'Jeton GitHub', /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ['slack-token', 'Jeton Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-key', 'Clé Stripe', /\b[sr]k_live_[A-Za-z0-9]{16,}\b/],
  ['google-api-key', 'Clé API Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['jwt', 'Jeton JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['url-credentials', 'Identifiants dans une URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"]+:[^\s:@/'"]{3,}@[^\s'"]+/i]
];
// affectation d'un secret littéral : password = "…", apiKey: '…'
const ASSIGN = /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)[A-Za-z0-9_.-]*)\s*[:=]\s*["']([^"'\s]{8,})["']/i;
const PLACEHOLDER = /^(?:x+|\*+|changeme|change[_-]?me|example|dummy|test|todo|null|none|password|secret|your[_-].*|<.*>|\$\{.*\}|\{\{.*\}\}|%\(.*\)s?)$/i;
const SKIP_FILES = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.lock|.*\.min\.js|.*\.(?:png|jpe?g|gif|pdf|svg))$/i;

function entropy(s) {
  const f = {};
  for (const c of s) f[c] = (f[c] || 0) + 1;
  return -Object.values(f).reduce((a, n) => a + (n / s.length) * Math.log2(n / s.length), 0);
}

function scan(patch) {
  const out = [];
  let file = null, line = 0;
  for (const l of patch.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(4) === '/dev/null' ? null : l.slice(4).replace(/^b\//, ''); continue; }
    if (l.startsWith('--- ') || l.startsWith('diff ') || l.startsWith('index ')) continue;
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { line = Number(h[1]); continue; }
    if (!file) continue;
    if (l.startsWith('+')) {
      const text = l.slice(1);
      if (!SKIP_FILES.test(file)) {
        let hit = RULES.find(([, , re]) => re.test(text));
        if (!hit) {
          const m = text.match(ASSIGN);
          if (m && !PLACEHOLDER.test(m[2]) && entropy(m[2]) >= 2.5 && !/^[A-Za-z]+$/.test(m[2]) ) hit = ['generic-secret', 'Secret littéral affecté à une variable'];
        }
        if (hit) out.push({ File: file, StartLine: line, RuleID: hit[0], Description: hit[1] });
      }
      line++;
    } else if (!l.startsWith('-')) line++;
  }
  return out;
}

module.exports = { scan };

if (require.main === module) {
  const [diff, outFile] = process.argv.slice(2);
  if (!diff || !outFile) { console.error('usage: scan-secrets.cjs <diff.patch> <sortie.json>'); process.exit(1); }
  const res = scan(fs.readFileSync(diff, 'utf8'));
  fs.writeFileSync(outFile, JSON.stringify(res, null, 2) + '\n');
  console.log(`secrets (intégré) : ${res.length} candidats`);
}

#!/usr/bin/env node
'use strict';
// Résolution sandbox pour toute la sécurité (fast, check, deep).
// Présent par défaut. Bloquer : CODE_CHECK_SANDBOX=off|absent|false|0|disabled|none|block
// Optionnel : préfixe OS (sandbox-exec, bwrap, …) — present seulement s'il isole (réseau refusé).
// usage: node sandbox-status.cjs          -> imprime present|absent
//        require('./sandbox-status.cjs').resolveSandbox()
const { spawnSync } = require('node:child_process');

const BLOCK = new Set(['off', 'absent', 'false', '0', 'disabled', 'none', 'block']);

function resolveSandbox(env = process.env) {
  const raw = env.CODE_CHECK_SANDBOX;
  if (raw === undefined || raw === null || String(raw).trim() === '') return 'present';
  const key = String(raw).trim().toLowerCase();
  if (BLOCK.has(key)) return 'absent';
  // Préfixe déclaré : doit exécuter true et refuser une connexion sortante.
  const ok = spawnSync('bash', ['-lc', `${raw} true`], { encoding: 'utf8', env });
  if (ok.status !== 0) return 'absent';
  const probe = `${raw} node -e 'const s=require("net").connect({host:"1.1.1.1",port:443,timeout:2000});s.on("connect",()=>process.exit(1));s.on("error",()=>process.exit(0));s.on("timeout",()=>process.exit(0))'`;
  const net = spawnSync('bash', ['-lc', probe], { encoding: 'utf8', env });
  return net.status === 0 ? 'present' : 'absent';
}

module.exports = { resolveSandbox, BLOCK };

if (require.main === module) {
  process.stdout.write(resolveSandbox() + '\n');
}

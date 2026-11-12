'use strict';
// Métriques de fin de run : durée depuis created_at, tokens depuis usage.json (ou inconnu).
// usage.json = { tokens: number|"unknown", elapsed_seconds: number, finished_at: ISO }
const fs = require('node:fs');
const path = require('node:path');

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} min ${r} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return mr ? `${h} h ${mr} min` : `${h} h`;
}

function formatTokens(tokens) {
  if (typeof tokens === 'number' && Number.isFinite(tokens) && tokens >= 0) {
    return String(Math.round(tokens));
  }
  return 'inconnu';
}

function readUsage(runDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir, 'usage.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

/** Calcule la durée, fusionne usage.json (préserve tokens déjà écrits), renvoie les lignes de résumé. */
function finalizeUsage(runDir, createdAt) {
  const finished = new Date();
  const start = createdAt ? new Date(createdAt) : finished;
  const elapsed = Number.isFinite(start.getTime())
    ? Math.max(0, (finished.getTime() - start.getTime()) / 1000)
    : 0;
  const prev = readUsage(runDir) || {};
  const tokens = (typeof prev.tokens === 'number' && Number.isFinite(prev.tokens) && prev.tokens >= 0)
    ? Math.round(prev.tokens)
    : 'unknown';
  const usage = {
    tokens,
    elapsed_seconds: Math.round(elapsed),
    finished_at: finished.toISOString()
  };
  fs.writeFileSync(path.join(runDir, 'usage.json'), JSON.stringify(usage) + '\n');
  return {
    usage,
    lines: [
      `Durée          → ${formatDuration(usage.elapsed_seconds)}`,
      `Tokens         → ${formatTokens(usage.tokens)}`
    ]
  };
}

module.exports = { formatDuration, formatTokens, readUsage, finalizeUsage };

#!/usr/bin/env node
'use strict';
// Validateur zéro dépendance pour les findings de revue.
// Sous-ensemble de JSON Schema : type, enum, pattern, minimum, minLength,
// required, properties, additionalProperties, items, $ref relatif.
// Ne couvre pas la revue sécurité (schéma Cloudflare, phase 4).
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_DIR = path.join(__dirname, '..', 'schemas');
const load = (name) => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'));

function typeOk(type, v) {
  switch (type) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number';
    case 'boolean': return typeof v === 'boolean';
    default: return false;
  }
}

function check(schema, value, at, errors) {
  if (schema.$ref) return check(load(schema.$ref), value, at, errors);
  if (schema.type && !typeOk(schema.type, value)) {
    errors.push(`${at}: type ${schema.type} attendu`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: valeur hors enum (${JSON.stringify(value)})`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: trop court`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: motif refusé (${value})`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${at}: < ${schema.minimum}`);
  }
  if (schema.type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}: champ requis ${key}`);
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(value)) {
      if (key in props) check(props[key], sub, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: propriété inconnue ${key}`);
    }
  }
  if (schema.type === 'array' && schema.items) value.forEach((item, i) => check(schema.items, item, `${at}[${i}]`, errors));
}

function validateFinding(obj) {
  const errors = [];
  check(load('review-findings.schema.json'), obj, '$', errors);
  return errors;
}
function validateFile(arr) {
  const errors = [];
  check(load('review-findings-file.schema.json'), arr, '$', errors);
  return errors;
}

module.exports = { validateFinding, validateFile };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: validate-review-findings.cjs <fichier.json>'); process.exit(3); }
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`illisible: ${e.message}`); process.exit(3); }
  const errors = validateFile(data);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`ok (${data.length} findings)`);
}

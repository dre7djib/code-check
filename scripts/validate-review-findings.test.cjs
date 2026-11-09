'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateFinding, validateFile } = require('./validate-review-findings.cjs');

const base = () => ({
  id: 'architecture:domain-imports-spring',
  axis: 'architecture',
  severity: 'blocking',
  file: 'src/main/java/com/acme/billing/domain/Invoice.java',
  line: 12,
  title: 'Le domaine importe Spring.',
  evidence: 'import org.springframework.stereotype.Component;',
  rule: 'layers.domain.forbidden_imports',
  source: 'agent'
});

test('objet complet accepté', () => {
  assert.deepStrictEqual(validateFinding(base()), []);
  assert.deepStrictEqual(validateFile([base()]), []);
});
test('severity inconnue refusée', () => {
  assert.ok(validateFinding({ ...base(), severity: 'critical' }).length > 0);
});
test('file égal à ../secret refusé', () => {
  assert.ok(validateFinding({ ...base(), file: '../secret' }).length > 0);
  assert.ok(validateFinding({ ...base(), file: 'a/../../b' }).length > 0);
  assert.ok(validateFinding({ ...base(), file: '/etc/passwd' }).length > 0);
});
test('propriété supplémentaire refusée', () => {
  assert.ok(validateFinding({ ...base(), extra: 1 }).length > 0);
});
test('route: security accepté', () => {
  assert.deepStrictEqual(validateFinding({ ...base(), route: 'security' }), []);
  assert.ok(validateFinding({ ...base(), route: 'other' }).length > 0);
});

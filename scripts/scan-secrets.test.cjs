'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { scan } = require('./scan-secrets.cjs');

const patch = (file, added) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,2 +1,${added.length + 2} @@\n ligne1\n${added.map((l) => '+' + l).join('\n')}\n ligne2\n`;

test('détecte les secrets courants à la bonne ligne du fichier', () => {
  const r = scan(patch('src/Conf.java', ['String a = "ok";', 'String k = "AKIAIOSFODNN7EXAMPLE";', 'String p = "-----BEGIN RSA PRIVATE KEY-----";', 'String t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";']));
  assert.deepStrictEqual(r.map((x) => [x.RuleID, x.StartLine]), [['aws-access-key', 3], ['private-key', 4], ['github-token', 5]]);
});
test('affectation littérale détectée, placeholders et valeurs lisibles ignorés', () => {
  const r = scan(patch('app.yml', ['password: "Xk9#mP2vQ8zLw4Rt"', 'password: "changeme"', 'password: "${DB_PASSWORD}"', 'token = "abcdefghij"', 'db_url = "jdbc:postgresql://u:s3cretPwd@host/db"']));
  assert.deepStrictEqual(r.map((x) => [x.RuleID, x.StartLine]), [['generic-secret', 2], ['url-credentials', 6]]);
});
test('la valeur du secret n’est jamais recopiée dans la sortie', () => {
  const out = JSON.stringify(scan(patch('a.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])));
  assert.doesNotMatch(out, /AKIAIOSFODNN7EXAMPLE/);
});
test('lignes supprimées, contexte et lockfiles ignorés', () => {
  const del = 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,1 +1,0 @@\n-String k = "AKIAIOSFODNN7EXAMPLE";\n';
  assert.deepStrictEqual(scan(del), []);
  assert.deepStrictEqual(scan(patch('package-lock.json', ['"x": "AKIAIOSFODNN7EXAMPLE"'])), []);
});

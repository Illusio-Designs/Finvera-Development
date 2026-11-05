const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/testimonialPresentation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { testimonialRating, testimonialInitials } = context.exports;
test('saved ratings remain accurate while malformed older values cannot crash the public page', () => {
  assert.equal(testimonialRating(4), 4); assert.equal(testimonialRating('3'), 3);
  assert.equal(testimonialRating(-1), 1); assert.equal(testimonialRating(100), 5);
  assert.equal(testimonialRating(null), 5); assert.equal(testimonialRating('invalid'), 5);
  assert.doesNotThrow(() => '★'.repeat(testimonialRating(-5)));
});
test('editor and public page use matching initials with an explicit override', () => {
  assert.equal(testimonialInitials('Aanya Mehta'), 'AM'); assert.equal(testimonialInitials('Aanya Mehta', 'AK'), 'AK');
  assert.equal(testimonialInitials('  Dev   Shah '), 'DS'); assert.equal(testimonialInitials(''), '?');
});

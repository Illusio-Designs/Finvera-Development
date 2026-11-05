const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, canonical, validUrl } = require('../src/controllers/projects.controller');
function check(body, method = 'POST') { let status = 200, error; validate({ body, method }, { status(value) { status = value; return this; }, json(value) { error = value; } }, () => {}); return { status, error, body }; }
test('new case studies default to private drafts and require a title', () => {
  assert.equal(check({ title: 'New story' }).body.status, 'draft');
  assert.equal(check({ title: ' ' }).status, 400);
  assert.equal(check({ title: 'Story', status: 'live' }).status, 400);
});
test('website/image links and array shapes are validated', () => {
  assert.equal(validUrl('javascript:alert(1)'), false);
  assert.equal(validUrl('/uploads/art.jpg', true), true);
  assert.equal(validUrl('//untrusted.test/art.jpg', true), false);
  assert.equal(check({ title: 'Story', url: 'javascript:alert(1)' }).status, 400);
  assert.equal(check({ results: [{ value: '30%' }] }, 'PATCH').status, 400);
  assert.equal(check({ results: ['30% — Growth'], featured: false }, 'PATCH').status, 200);
});
test('legacy JSON-list representations compare without false conflicts', () => {
  assert.equal(canonical('tags', '["Design"]'), canonical('tags', ['Design']));
  assert.equal(canonical('gallery', null), canonical('gallery', []));
  assert.equal(canonical('position', '0'), canonical('position', 0));
});

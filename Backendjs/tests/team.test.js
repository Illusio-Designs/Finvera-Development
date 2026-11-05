const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, canonical } = require('../src/controllers/team.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('new team profiles default to private and reject invalid profile fields', () => {
  assert.equal(check({ name: 'Maya' }).body.status, 'draft');
  for (const body of [{ name: '' }, { name: 'Maya', bio: {} }, { name: 'Maya', position: -1 }, { name: 'Maya', photo: 'javascript:alert(1)' }, { name: 'Maya', status: 'invalid' }]) assert.equal(check(body).status, 400);
  assert.equal(check({ name: 'Maya', photo: '/uploads/maya.jpg', status: 'published' }).status, 200);
});
test('profile snapshots compare unordered social objects without losing their values', () => {
  assert.equal(canonical('socials', { b: 'two', a: 'one' }), canonical('socials', { a: 'one', b: 'two' }));
  assert.notEqual(canonical('socials', { a: 'one' }), canonical('socials', { a: 'changed' }));
  assert.equal(canonical('position', '2'), canonical('position', 2));
});

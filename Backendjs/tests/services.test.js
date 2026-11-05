const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/services.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('new services default to drafts and invalid editor values are rejected', () => {
  assert.equal(check({ title: 'Consulting' }).body.status, 'draft');
  for (const body of [{ title: ' ' }, { title: 'Service', icon: 'missing' }, { title: 'Service', position: -1 }, { title: 'Service', position: 1.5 }, { title: 'Service', status: 'live' }, { title: 'Service', description: {} }]) assert.equal(check(body).status, 400);
});
test('snapshots detect changed service text and order without false null or numeric conflicts', () => {
  assert.equal(changed({ description: null, position: 0 }, { description: '', position: '0' }), false);
  assert.equal(changed({ description: 'Updated' }, { description: 'Old' }), true);
  assert.equal(changed({ position: 2 }, { position: 1 }), true);
});

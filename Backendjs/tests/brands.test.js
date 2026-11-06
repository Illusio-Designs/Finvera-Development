const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/brands.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('brand drafts and published content validate names, icons and website URLs', () => {
 assert.equal(check({ name: 'Studio' }).body.status, 'draft');
 assert.equal(check({ name: 'Studio', status: 'published', description: '' }).status, 400);
 assert.equal(check({ name: 'Studio', status: 'published', description: 'Thoughtful design.', url: 'https://example.test' }).status, 200);
 for (const body of [{ name: '' }, { name: 'a'.repeat(256) }, { name: 'Studio', url: 'javascript:alert(1)' }, { name: 'Studio', url: 'https://name:password@example.test/' }, { name: 'Studio', category: {} }, { name: 'Studio', position: -1 }]) assert.equal(check(body).status, 400);
});
test('brand snapshots protect website links and categories as well as content', () => {
 const row = { name: 'Studio', category: 'Design', url: 'https://example.test', icon: 'paint', description: 'Care', position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, position: '1' }), false); assert.equal(changed(row, { ...row, url: 'https://other.test' }), true); assert.equal(changed(row, { ...row, category: 'Changed' }), true);
});

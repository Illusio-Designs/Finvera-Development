const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/stats.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('stats preserve formatted figures, default to drafts and require a label to publish', () => {
 for (const value of ['0', '250+', '99.9%', '1,200+', '24/7', '4min', 'Trusted']) { const result = check({ value }); assert.equal(result.status, 200); assert.equal(result.body.value, value); assert.equal(result.body.status, 'draft'); }
 assert.equal(check({ value: '250+', status: 'published', label: 'Projects delivered' }).status, 200);
 for (const body of [{ value: '' }, { value: ' ' }, { value: 250 }, { value: 'a'.repeat(256) }, { value: '250+', label: {} }, { value: '250+', label: 'a'.repeat(256) }, { value: '250+', status: 'published', label: '' }, { value: '250+', position: -1 }, { value: '250+', status: 'hidden' }]) assert.equal(check(body).status, 400);
});
test('stat snapshots detect content and order changes without false conflicts on position types', () => {
 const row = { value: '99.9%', label: 'Uptime', position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, position: '1' }), false);
 for (const patch of [{ value: '99%' }, { label: 'Availability' }, { position: 2 }, { status: 'published' }]) assert.equal(changed(row, { ...row, ...patch }), true);
});

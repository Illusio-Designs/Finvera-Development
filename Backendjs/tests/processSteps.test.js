const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/processSteps.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('process steps support private drafts and validate published descriptions and icons', () => {
 assert.equal(check({ title: 'Craft matters' }).body.status, 'draft');
 assert.equal(check({ title: 'Craft matters', status: 'published', description: '' }).status, 400);
 assert.equal(check({ title: 'Craft matters', status: 'published', description: 'Care in every detail.', icon: 'award' }).status, 200);
 for (const body of [{ title: 'Craft', step: {} }, { title: 'Craft', step: 'a'.repeat(256) }, { title: '' }, { title: 'a'.repeat(256) }, { title: 'Craft', icon: 'invalid' }, { title: 'Craft', position: -1 }]) assert.equal(check(body).status, 400);
});
test('snapshots protect step content while normalizing position types', () => {
 const row = { title: 'Craft', step: '01', description: 'Every detail matters.', icon: 'award', position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, position: '1' }), false); assert.equal(changed(row, { ...row, icon: 'rocket' }), true); assert.equal(changed(row, { ...row, step: '02' }), true);
});

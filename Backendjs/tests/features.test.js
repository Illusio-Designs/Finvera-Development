const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/features.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('features default to drafts and validate content before publishing', () => {
 assert.equal(check({ title: 'A clearer pipeline' }).body.status, 'draft');
 assert.equal(check({ title: 'A clearer pipeline', status: 'published', description: 'Know what to do next.' }).status, 200);
 for (const body of [{ title: '' }, { title: ' ' }, { title: 'a'.repeat(256) }, { title: 'Pipeline', status: 'published', description: '' }, { title: 'Pipeline', description: {} }, { title: 'Pipeline', position: -1 }, { title: 'Pipeline', status: 'hidden' }]) assert.equal(check(body).status, 400);
});
test('feature snapshots detect content and publication changes without false position conflicts', () => {
 const row = { title: 'Pipeline', description: 'A clear next step.', position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, position: '1' }), false);
 for (const patch of [{ title: 'Insights' }, { description: 'See your progress.' }, { position: 2 }, { status: 'published' }]) assert.equal(changed(row, { ...row, ...patch }), true);
});

const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/milestones.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('milestones validate draft defaults, period labels and published descriptions', () => {
 assert.equal(check({ title: 'A new beginning', year: 'Today' }).body.status, 'draft');
 assert.equal(check({ title: 'A new beginning', status: 'published', description: '' }).status, 400);
 assert.equal(check({ title: 'A new beginning', year: '2026', status: 'published', description: 'A new chapter.' }).status, 200);
 assert.equal(check({ title: 'Title', year: {} }).status, 400);
 assert.equal(changed({ year: '2024' }, { year: 'Today' }), true);
});

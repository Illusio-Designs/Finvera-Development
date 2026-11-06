const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed } = require('../src/controllers/faqs.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('FAQ drafts can be incomplete while published answers must be ready', () => {
 assert.equal(check({ question: 'How do we start?' }).body.status, 'draft');
 assert.equal(check({ question: 'How do we start?', status: 'published', answer: ' ' }).status, 400);
 assert.equal(check({ question: 'How do we start?', status: 'published', answer: 'Book a call.' }).status, 200);
 for (const body of [{ question: '' }, { question: 'a'.repeat(256) }, { question: 'Question', position: -1 }, { question: 'Question', answer: {} }]) assert.equal(check(body).status, 400);
});
test('FAQ snapshots protect answers and normalize saved positions', () => {
 const row = { question: 'Question', answer: 'Saved answer', position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, position: '1' }), false);
 assert.equal(changed(row, { ...row, answer: 'Old answer' }), true);
});

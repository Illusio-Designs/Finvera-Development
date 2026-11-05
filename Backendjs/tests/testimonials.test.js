const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, canonical } = require('../src/controllers/testimonials.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('private drafts may be incomplete but published quotes require client words', () => {
  assert.equal(check({ name: 'Client' }).body.status, 'draft');
  assert.equal(check({ name: 'Client' }).body.quote, '');
  assert.equal(check({ name: 'Client', status: 'published', quote: ' ' }).status, 400);
  assert.equal(check({ name: 'Client', status: 'published', quote: 'Thoughtful work.' }).status, 200);
  assert.equal(check({ name: ' ' }).status, 400);
});
test('invalid ratings and display positions are rejected', () => {
  for (const rating of [-1, 0, 6, 2.5, null, 'wrong']) assert.equal(check({ rating }, 'PATCH').status, 400);
  for (const position of [-1, 2.5]) assert.equal(check({ position }, 'PATCH').status, 400);
  assert.equal(check({ rating: 4, position: 0 }, 'PATCH').status, 200);
  assert.equal(canonical('rating', '4'), canonical('rating', 4));
});

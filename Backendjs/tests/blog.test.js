const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, canonical } = require('../src/controllers/blog.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('article drafts and first publication dates', () => {
 assert.equal(check({ title: 'A thoughtful article' }).body.status, 'draft');
 assert.ok(check({ title: 'Published', status: 'published' }).body.publishedAt instanceof Date);
 assert.equal(check({ title: 'Published', status: 'published', publishedAt: '2026-11-05T10:30:00Z' }).body.publishedAt, '2026-11-05T10:30:00Z');
 assert.equal(check({ title: ' ' }).status, 400);
 for (const body of [{ content: {} }, { tags: [1] }, { publishedAt: 'wrong' }, { coverImage: 'javascript:alert(1)' }, { status: 'invalid' }]) assert.equal(check(body, 'PATCH').status, 400);
});
test('article date snapshots compare database dates with JSON dates', () => {
 assert.equal(canonical('publishedAt', new Date('2026-11-05T10:30:00Z')), canonical('publishedAt', '2026-11-05T10:30:00.000Z'));
 assert.doesNotThrow(() => canonical('publishedAt', 'invalid'));
});

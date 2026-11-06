const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate } = require('../src/controllers/seo.controller');
function check(body, page = 'home') { let status = 200; validate({ body, params: { page } }, { status(value) { status = value; return this; }, json() {} }, () => {}); return status; }
test('SEO accepts valid fields and refuses invalid URLs, types and lengths', () => {
 assert.equal(check({ title: 'Home', canonical: 'https://www.finvera.solutions/', ogImage: '/uploads/share.jpg', noindex: false }), 200);
 for (const body of [{ noindex: 'false' }, { canonical: '/about' }, { canonical: 'javascript:alert(1)' }, { ogImage: 'data:image/png,abc' }, { title: {} }, { keywords: 'a'.repeat(256) }]) assert.equal(check(body), 400);
 assert.equal(check({}, '../home'), 400);
 assert.equal(check({ canonical: null, ogImage: null, noindex: true }), 200);
});

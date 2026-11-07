const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, changed, validImage } = require('../src/controllers/logos.controller');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('logos default to drafts and support an intentional company-name fallback', () => {
 assert.equal(check({ name: 'Acme' }).body.status, 'draft'); assert.equal(check({ name: 'Acme', image: null, status: 'published' }).status, 200);
 for (const body of [{ name: '' }, { name: ' ' }, { name: 1 }, { name: 'a'.repeat(256) }, { name: 'Acme', image: {} }, { name: 'Acme', position: -1 }, { name: 'Acme', status: 'hidden' }]) assert.equal(check(body).status, 400);
});
test('logo image addresses accept uploads and HTTP images while rejecting invalid sources', () => {
 for (const image of [null, '', '/uploads/logo.svg', 'https://example.test/logo.png', 'http://example.test/logo.webp?x=1']) assert.equal(validImage(image), true);
 for (const image of ['javascript:alert(1)', 'data:image/png;base64,abc', '//example.test/logo.png', 'https://name:password@example.test/logo.svg', 'https://example.test/logo a.png', 'x'.repeat(256)]) assert.equal(validImage(image), false);
});
test('logo snapshots detect name, image, publication and order changes', () => {
 const row = { name: 'Acme', image: null, position: 1, status: 'draft' };
 assert.equal(changed(row, { ...row, image: '', position: '1' }), false);
 for (const patch of [{ name: 'New name' }, { image: '/uploads/logo.svg' }, { position: 2 }, { status: 'published' }]) assert.equal(changed(row, { ...row, ...patch }), true);
});

const { test } = require('node:test'), assert = require('node:assert/strict');
const { validate, validPageSlug, fixedPageSlug, updateRecord } = require('../src/controllers/pages.controller');
const { Page, sequelize } = require('../src/models');
function check(body, method = 'POST') { let status = 200; validate({ body, method }, { status(value) { status = value; return this; }, json() {} }, () => {}); return { status, body }; }
test('pages default to private and protect built-in URLs', () => {
 assert.equal(check({ title: 'Accessibility' }).body.slug, 'accessibility');
 assert.equal(check({ title: 'Accessibility' }).body.status, 'draft');
 for (const slug of ['about','blog','dashboard','login','reset-password','data-deletion','123','/test','a--b','UPPER','sitemap.xml']) assert.equal(validPageSlug(slug), false, slug);
 for (const slug of ['privacy','terms','accessibility','our-promise']) assert.equal(validPageSlug(slug), true, slug);
 assert.equal(check({ title: 'Blog' }).status, 400);
 assert.equal(check({ content: {} }, 'PATCH').status, 400);
 assert.ok(fixedPageSlug('privacy')); assert.ok(fixedPageSlug('terms'));
});
test('fixed policy URLs cannot be renamed by bypassing the UI', async () => {
 const transaction = sequelize.transaction, find = Page.findByPk;
 sequelize.transaction = async fn => fn({ LOCK: { UPDATE: 'UPDATE' } });
 Page.findByPk = async () => ({ slug: 'privacy' });
 try { await assert.rejects(updateRecord({ params: { id: 1 }, body: { slug: 'new-policy' } }), /addresses are fixed/); }
 finally { sequelize.transaction = transaction; Page.findByPk = find; }
});

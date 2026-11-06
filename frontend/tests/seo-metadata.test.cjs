const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const context = { exports: {}, process, URL };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/seoMetadata.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { seoMetadata, SEO_PAGES } = context.exports;
test('saved search, sharing, canonical and no-index fields reach public metadata', () => {
 const meta = seoMetadata({ page: 'about', title: 'About our studio', description: 'A considered team.', keywords: 'design, crm', canonical: 'https://example.test/about', ogImage: '/uploads/social.jpg', noindex: true });
 assert.equal(meta.title.absolute, 'About our studio'); assert.equal(meta.description, 'A considered team.');
 assert.equal(meta.alternates.canonical, 'https://example.test/about'); assert.equal(meta.robots.index, false); assert.equal(meta.robots.follow, true);
 assert.ok(meta.openGraph.images[0].url.endsWith('/uploads/social.jpg')); assert.equal(meta.twitter.card, 'summary_large_image');
 assert.equal(seoMetadata({ page: 'home', noindex: false }).robots.index, true);
 assert.doesNotThrow(() => seoMetadata({ page: 'home', ogImage: 'http://[' }));
});
test('all seven real page metadata handlers use the saved SEO mapping', () => {
 for (const page of SEO_PAGES) {
  const source = fs.readFileSync(path.join(__dirname, '../app/(site)', page === 'home' ? 'page.tsx' : `${page}/page.tsx`), 'utf8');
  assert.ok(source.includes(`getSeo("${page}")`)); assert.ok(source.includes('return seoMetadata(s);'));
  const meta = seoMetadata({ page }); assert.ok(meta.title.absolute); assert.ok(meta.description); assert.ok(meta.alternates.canonical.endsWith(page === 'home' ? '/' : `/${page}`));
 }
});

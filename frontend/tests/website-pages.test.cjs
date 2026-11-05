const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}, globals = {}) {
 const context = { exports: {}, process, ...globals, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context);
 return context.exports;
}
const rules = load('lib/websitePages.ts');
test('page URLs reserve existing routes while supporting custom pages', () => {
 for (const slug of ['about','services','work','blog','login','reset-password','dashboard','data-deletion','123','/test','a--b','UPPER']) assert.equal(rules.validPageSlug(slug), false, slug);
 for (const slug of ['privacy','terms','accessibility','our-promise']) assert.equal(rules.validPageSlug(slug), true, slug);
});
test('the real public route renders published custom content and rejects drafts or missing pages', async () => {
 let page = { title: 'Our promise', slug: 'our-promise', status: 'published', content: '<h2>Clear information</h2>', updatedAt: '2026-11-05T10:00:00Z' };
 const mocks = { '@/lib/api': { getPage: async () => page }, '@/lib/websitePages': rules, 'next/navigation': { notFound() { throw new Error('NEXT_NOT_FOUND'); } }, 'next/link': { __esModule: true, default: props => React.createElement('a', props) } };
 const legal = load('components/LegalPage.tsx', mocks);
 const route = load('app/(site)/[slug]/page.tsx', { ...mocks, '@/components/LegalPage': legal });
 const params = Promise.resolve({ slug: 'our-promise' });
 const element = await route.default({ params });
 assert.ok(renderToStaticMarkup(await element.type(element.props)).includes('<h2>Clear information</h2>'));
 assert.equal((await route.generateMetadata({ params })).title, 'Our promise');
 page = { ...page, status: 'draft' }; await assert.rejects(legal.default({ slug: 'our-promise', fallbackTitle: 'Page' }), /NEXT_NOT_FOUND/);
 page = undefined; await assert.rejects(legal.default({ slug: 'missing-page', fallbackTitle: 'Page' }), /NEXT_NOT_FOUND/);
 await assert.rejects(route.default({ params: Promise.resolve({ slug: 'dashboard' }) }), /NEXT_NOT_FOUND/);
});
test('public page reads avoid a stale frontend cache after unpublishing', async () => {
 let options, requested;
 const api = load('lib/api.ts', {}, { fetch: async (url, opts) => { requested = url; options = opts; return { ok: true, json: async () => ({ title: 'Current page' }) }; } });
 await api.getPage('our-promise'); assert.equal(options.cache, 'no-store'); assert.ok(requested.endsWith('/api/pages/our-promise'));
});

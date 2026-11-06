const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) { const context = { exports: {}, URL, require: name => Object.hasOwn(mocks,name) ? mocks[name] : require(name) }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context); return context.exports; }
const helper = load('lib/brandPresentation.ts');
const { default: BrandShowcase } = load('components/BrandShowcase.tsx', { '@/lib/brandPresentation': helper, '@/components/contentIcon': { __esModule: true, default: () => null } });
test('brand showcase uses real published count and disappears without published brands', () => {
 assert.equal(renderToStaticMarkup(React.createElement(BrandShowcase, { brands: [] })), '');
 assert.equal(renderToStaticMarkup(React.createElement(BrandShowcase, { brands: [{ id: 1, name: 'Private', status: 'draft' }] })), '');
 const html = renderToStaticMarkup(React.createElement(BrandShowcase, { brands: [{ id: 2, name: 'Studio', category: 'Design', description: '<b>Care</b>', status: 'published' }] }));
 assert.ok(html.includes('1 brand.')); assert.ok(html.includes('&lt;b&gt;Care&lt;/b&gt;'));
 const about = fs.readFileSync(path.join(__dirname, '../app/(site)/about/page.tsx'), 'utf8'); assert.ok(about.includes('<BrandShowcase brands={brandsRes} />')); assert.equal(about.includes('FB_BRANDS'),false);
});
test('invalid legacy website URLs never become clickable showcase links', () => {
 for(const url of ['javascript:alert(1)', '/relative', 'https://name:password@example.test/']) assert.equal(helper.brandWebsite(url),undefined);
 const html = renderToStaticMarkup(React.createElement(BrandShowcase, { brands: [{ id: 1, name: 'Legacy', url: 'javascript:alert(1)', status: 'published' }] })); assert.equal(html.includes('href='),false);
 assert.equal(helper.brandWebsite('https://example.test'), 'https://example.test/');
});

const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require: name => name === '@/components/contentIcon' ? { __esModule: true, default: () => null } : require(name) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/AboutValues.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const AboutValues = context.exports.default;
test('unpublishing all values leaves About without sample cards', () => {
 assert.equal(renderToStaticMarkup(React.createElement(AboutValues, { items: [] })), '');
 assert.equal(renderToStaticMarkup(React.createElement(AboutValues, { items: [{ id: 1, title: 'Private', status: 'draft' }] })), '');
});
test('About renders saved order and descriptions as text', () => {
 const html = renderToStaticMarkup(React.createElement(AboutValues, { items: [{ id: 2, title: 'Craft', description: '<b>Care</b>', icon: 'award', status: 'published' }, { id: 1, title: 'Ownership', description: 'Own the result.', status: 'published' }] }));
 assert.ok(html.indexOf('Craft') < html.indexOf('Ownership')); assert.ok(html.includes('&lt;b&gt;Care&lt;/b&gt;'));
 const about = fs.readFileSync(path.join(__dirname, '../app/(site)/about/page.tsx'), 'utf8'); assert.ok(about.includes('<AboutValues items={valuesRes} />')); assert.equal(about.includes('FB_VALUES'), false);
});

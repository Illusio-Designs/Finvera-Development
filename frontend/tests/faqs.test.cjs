const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/HomeFaqs.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const HomeFaqs = context.exports.default;
test('Home shows no sample answers when every FAQ is unpublished', () => {
 assert.equal(renderToStaticMarkup(React.createElement(HomeFaqs, { items: [] })), '');
 assert.equal(renderToStaticMarkup(React.createElement(HomeFaqs, { items: [{ id: 1, question: 'Private', answer: 'Unfinished', status: 'draft' }] })), '');
});
test('Home preserves the published order and treats answers as text', () => {
 const html = renderToStaticMarkup(React.createElement(HomeFaqs, { items: [{ id: 2, question: 'First?', answer: '<script>example</script>\nNext line', status: 'published' }, { id: 1, question: 'Second?', answer: 'A clear answer.', status: 'published' }] }));
 assert.ok(html.indexOf('First?') < html.indexOf('Second?')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('white-space:pre-wrap'));
 const home = fs.readFileSync(path.join(__dirname, '../app/(site)/page.tsx'), 'utf8'); assert.ok(home.includes('<HomeFaqs items={faqsRes} />')); assert.equal(home.includes('FB_FAQS'), false);
});

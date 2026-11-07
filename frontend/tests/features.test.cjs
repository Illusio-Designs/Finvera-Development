const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require: name => name === '@/components/icons' ? { Check: () => null } : require(name) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/SolutionFeatures.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const render = items => renderToStaticMarkup(React.createElement(context.exports.default, { items }));
test('homepage shows only published features and has no sample-content fallback', () => {
 assert.equal(render([]), ''); assert.equal(render([{ id: 1, title: 'Private feature', status: 'draft' }]), '');
 const home = fs.readFileSync(path.join(__dirname, '../app/(site)/page.tsx'), 'utf8'); assert.ok(home.includes('<SolutionFeatures items={featuresRes} />')); assert.equal(home.includes('FB_FEATURES'), false);
});
test('saved order and multiline text survive public rendering, including duplicate titles', () => {
 const html = render([{ id: 3, title: 'Same title', description: '<b>First</b>\nNext line', status: 'published' }, { id: 2, title: 'Private', description: 'Hidden', status: 'draft' }, { id: 1, title: 'Same title', description: 'Second benefit', status: 'published' }]);
 assert.ok(html.indexOf('First') < html.indexOf('Second benefit')); assert.equal(html.includes('Private'), false); assert.ok(html.includes('&lt;b&gt;First&lt;/b&gt;\nNext line')); assert.equal((html.match(/<li>/g) || []).length, 2); assert.ok(html.includes('white-space:pre-wrap'));
});

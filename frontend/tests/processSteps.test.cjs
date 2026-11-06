const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const { renderToStaticMarkup } = require('react-dom/server');
async function render(items) {
 const context = { exports: {}, require: name => name === '@/components/contentIcon' ? { __esModule: true, default: () => null } : name === '@/lib/api' ? { getProcessSteps: async () => items } : require(name) };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/ProcessSteps.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
 return renderToStaticMarkup(await context.exports.default({}));
}
test('Home and Services show no sample process when all steps are unpublished', async () => {
 assert.equal(await render([]), ''); assert.equal(await render([{ id: 1, title: 'Private step', status: 'draft' }]), '');
});
test('process retains saved order, custom labels and safe text; blank labels follow visible order', async () => {
 const html = await render([{ id: 3, title: 'Private', status: 'draft' }, { id: 2, title: 'Discover', step: 'A', description: '<b>Research</b>', status: 'published' }, { id: 1, title: 'Design', step: '', description: 'Make it clear.', status: 'published' }]);
 assert.ok(html.indexOf('Discover') < html.indexOf('Design')); assert.ok(html.includes('A.')); assert.ok(html.includes('02.')); assert.ok(html.includes('&lt;b&gt;Research&lt;/b&gt;')); assert.equal(html.includes('Private'), false);
 for (const route of ['page.tsx', 'services/page.tsx']) assert.ok(fs.readFileSync(path.join(__dirname, '../app/(site)', route), 'utf8').includes('<ProcessSteps'));
});

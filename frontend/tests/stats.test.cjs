const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/WebsiteStats.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const render = items => renderToStaticMarkup(React.createElement(context.exports.default, { items }));
test('homepage hides unpublished stats and does not restore sample figures', () => {
 assert.equal(render([]), ''); assert.equal(render([{ id: 1, value: '42', label: 'Private figure', status: 'draft' }]), '');
 const home = fs.readFileSync(path.join(__dirname, '../app/(site)/page.tsx'), 'utf8'); assert.ok(home.includes('<WebsiteStats items={statsRes} />')); assert.equal(home.includes('FB_STATS'), false);
});
test('stats render exact values without JS, preserve saved order and safely display labels', () => {
 const html = render([{ id: 2, value: '250+', label: '<b>Projects</b>', status: 'published' }, { id: 1, value: '99.9%', label: 'Availability', status: 'published' }, { id: 3, value: '24/7', label: 'Support', status: 'published' }]);
 assert.ok(html.includes('>250+</b>')); assert.ok(html.includes('>99.9%</b>')); assert.ok(html.includes('>24/7</b>')); assert.ok(html.includes('&lt;b&gt;Projects&lt;/b&gt;')); assert.ok(html.indexOf('Projects') < html.indexOf('Availability')); assert.equal((html.match(/data-count=/g) || []).length, 1);
 for (const value of ['1,200+', '007', '9007199254740993', 'Trusted']) assert.equal(render([{ id: 1, value, label: 'Exact display' }]).includes('data-count='), false);
 assert.ok(render([{ id: 1, value: '0', label: 'Count' }]).includes('data-count="0"'));
});

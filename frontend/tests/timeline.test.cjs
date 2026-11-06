const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/AboutTimeline.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
const Component = context.exports.default;
test('timeline uses saved order, supports period labels, and hides drafts without sample milestones', () => {
 assert.equal(renderToStaticMarkup(React.createElement(Component, { items: [] })), '');
 const html=renderToStaticMarkup(React.createElement(Component,{items:[{id:2,title:'First',year:'Today',description:'<b>A chapter</b>',status:'published'},{id:1,title:'Private',year:'2026',status:'draft'},{id:3,title:'Next',year:'Tomorrow',status:'published'}]}));
 assert.ok(html.indexOf('First') < html.indexOf('Next'));assert.equal(html.includes('Private'),false);assert.ok(html.includes('&lt;b&gt;A chapter&lt;/b&gt;'));
 const about=fs.readFileSync(path.join(__dirname,'../app/(site)/about/page.tsx'),'utf8');assert.ok(about.includes('<AboutTimeline items={timelineRes} />'));assert.equal(about.includes('FB_TIMELINE'),false);
});

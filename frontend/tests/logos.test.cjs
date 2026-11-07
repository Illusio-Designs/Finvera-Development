const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks={}) { const context={exports:{},URL,process:{env:{NEXT_PUBLIC_API_URL:'https://api.example.test'}},require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);return context.exports; }
const helper=load('lib/logoPresentation.ts');
const mark=load('components/LogoMark.tsx',{'@/lib/logoPresentation':helper});
const {default:ClientLogos}=load('components/ClientLogos.tsx',{'@/components/LogoMark':mark});
const render=(items,variant)=>renderToStaticMarkup(React.createElement(ClientLogos,{items,variant}));
test('Home and About hide all unpublished logos and retain saved company order',()=>{
 for(const variant of ['marquee','grid']) { assert.equal(render([],variant),'');assert.equal(render([{id:1,name:'Private',status:'draft'}],variant),'');const html=render([{id:2,name:'First',status:'published'},{id:1,name:'Private',status:'draft'},{id:3,name:'Second',status:'published'}],variant);assert.ok(html.indexOf('First')<html.indexOf('Second'));assert.equal(html.includes('Private'),false); }
 for(const [file,needle]of [['page.tsx','<ClientLogos items={logosRes} />'],['about/page.tsx','<ClientLogos items={clientLogos} variant="grid" />']])assert.ok(fs.readFileSync(path.join(__dirname,'../app/(site)',file),'utf8').includes(needle));
});
test('company-name fallback is escaped and uploaded logo URLs resolve to the API origin',()=>{
 assert.equal(helper.logoImage('/uploads/logo.svg'),'https://api.example.test/uploads/logo.svg');
 for(const image of ['javascript:alert(1)','//example.test/logo.png','https://name:secret@example.test/logo.png'])assert.equal(helper.logoImage(image),undefined);
 const html=render([{id:1,name:'<b>Acme</b>'}], 'grid');assert.ok(html.includes('&lt;b&gt;Acme&lt;/b&gt;'));assert.equal(html.includes('<img'),false);
 const marquee=render([{id:1,name:'Acme',image:'/uploads/logo.svg'}]);assert.ok(marquee.includes('src="https://api.example.test/uploads/logo.svg"'));assert.equal((marquee.match(/aria-hidden="true"/g)||[]).length,1);
});

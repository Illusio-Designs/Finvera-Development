const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):e.name==='page.tsx'?[path.join(p,e.name)]:[]);
test('dashboard pages use the shared workspace header rather than local title markup',()=>{
 const files=[...walk(path.join(root,'app/dashboard')),path.join(root,'components/admin/Today.tsx'),path.join(root,'components/admin/SocialProfileEditor.tsx')];
 for(const file of files){const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(node){if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))assert.notEqual(node.tagName.getText(ast),'h1',path.relative(root,file)+' must use WorkspaceHero');ts.forEachChild(node,visit);}visit(ast);}
});
test('shared title, font and field tokens are mounted at the dashboard boundary',()=>{
 const layout=fs.readFileSync(path.join(root,'app/dashboard/layout.tsx'),'utf8'),tokens=fs.readFileSync(path.join(root,'components/admin/workspace-tokens.css'),'utf8');assert.ok(layout.includes('workspace-tokens.css'));assert.ok(layout.includes('fw-surface'));for(const token of ['--ui-font-body','--ui-font-heading','--ui-page-title','--ui-page-title-mobile','--ui-field-height'])assert.ok(tokens.includes(token),token);assert.equal(tokens.includes('!important'),false);
});

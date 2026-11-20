const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
function compile(file){return ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}
const people={exports:{}};vm.runInNewContext(compile('peopleTypes.ts'),people);
function client(fetch){let token='original-token';const location={pathname:'/dashboard',href:'/dashboard'};const storage={getItem:()=>token,removeItem:()=>{token=null;},setItem:(_k,v)=>{token=v;}};const ctx={exports:{},process:{env:{}},window:{localStorage:storage},localStorage:storage,location,fetch,File,FormData,URLSearchParams,require:name=>{if(name==='./peopleTypes')return people.exports;assert.equal(name,'./resourceMachine');return{readCacheState:()=> 'stale'};}};vm.runInNewContext(compile('adminApi.ts'),ctx);return{...ctx.exports,location,token:()=>token};}
test('HTML gateway failures preserve HTTP status without showing HTML or a JSON parser exception',async()=>{const c=client(async()=>new Response('<html>Proxy failure</html>',{status:502}));await assert.rejects(c.api.list('leads'),e=>e.status===502&&/502/.test(e.message)&&!e.message.includes('<html>')&&!e.message.includes('JSON'));});
test('invalid successful responses report a recoverable server-response error',async()=>{const c=client(async()=>new Response('not-json',{status:200}));await assert.rejects(c.api.list('leads'),e=>e.status===200&&/invalid response/.test(e.message));});
test('a late 401 from an old session cannot clear a newly stored login',async()=>{let c;c=client(async()=>{c.setToken('new-token');return new Response('{"message":"Expired"}',{status:401});});await assert.rejects(c.api.list('leads'),e=>e.status===401);assert.equal(c.token(),'new-token');assert.equal(c.location.href,'/dashboard');});
test('a current-session 401 still clears the session and redirects to login',async()=>{const c=client(async()=>new Response('{}',{status:401}));await assert.rejects(c.api.list('leads'),/Session expired/);assert.equal(c.token(),null);assert.equal(c.location.href,'/login');});

test('employee uploads send multipart while existing JSON callers keep working',async()=>{
 const calls=[];
 const c=client(async(url,options)=>{calls.push({url,...options});return new Response('{}',{status:201});});
 const details={name:'Fixture'};
 await c.peopleApi.onboard(details);
 assert.equal(calls[0].headers['Content-Type'],'application/json');
 assert.deepEqual(JSON.parse(calls[0].body),details);
 const form=new FormData();
 form.append('pan',new File(['%PDF-1.4'],'fixture.pdf',{type:'application/pdf'}));
 form.append('aadhaar',new File([],''));
 await c.peopleApi.onboard(details,form);
 assert.equal(calls[1].headers['Content-Type'],undefined);
 assert.equal(calls[1].body.get('pan').name,'pan');
 assert.equal(calls[1].body.has('aadhaar'),false);
 assert.deepEqual(JSON.parse(calls[1].body.get('details')),details);
});
test('employee downloads use the signed-in session and retain the file MIME type',async()=>{
 const c=client(async(url,options)=>{
  assert.match(url,/\/people\/employees\/3\/documents\/pan$/);
  assert.equal(options.headers.Authorization,'Bearer original-token');
  return new Response('%PDF-1.4',{headers:{'Content-Type':'application/pdf'}});
 });
 const file=await c.peopleApi.downloadDocument(3,'pan');
 assert.equal(file.type,'application/pdf');
 assert.equal(await file.text(),'%PDF-1.4');
});

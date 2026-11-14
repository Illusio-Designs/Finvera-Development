const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const file=path.resolve(__dirname,'../src/controllers/socialReports.controller.js'),realRequire=createRequire(file);
function controller(){const calls=[],models={sequelize:{transaction:fn=>fn({test:true})},SocialClient:{findOne:async()=>({name:'Brand A'})}};for(const model of ['SocialPost','SocialPublishJob','SocialAccount','SocialStat','SocialPostEvent'])models[model]={findAll:async query=>{calls.push({model,query});return model==='SocialPublishJob'?[{postId:1,platform:'facebook',status:'published',publishedAt:'2026-10-01T01:00:00Z',metrics:{likes:0}}]:model==='SocialPost'?[{id:1,theme:'Published result',format:'Post'}]:[];}};const context={module:{exports:{}},require:name=>name==='../models'?models:name==='../utils/audit'?{record(){}}:name==='./kpi.controller'?{}:realRequire(name),Buffer};vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});return{...context.module.exports,calls};}
test('monthly brand report rejects an unassigned brand before any activity query',async()=>{const {build,calls}=controller();await assert.rejects(build({socialScope:new Set(['Brand A'])},{kind:'client',brand:'Brand B',month:'2026-10'}),error=>error.status===404);assert.equal(calls.length,0);});
test('brand report queries only confirmed publications and their content metadata',async()=>{
 const {build,calls}=controller();const data=await build({socialScope:new Set(['Brand A'])},{kind:'client',brand:'Brand A',month:'2026-10'});
 assert.equal(data.totals.published,1);assert.equal(data.activity,undefined);assert.equal(data.totals.planned,undefined);assert.equal(calls.some(c=>c.model==='SocialPostEvent'),false);
 const jobs=calls.find(c=>c.model==='SocialPublishJob');assert.equal(jobs.query.where.client,'Brand A');assert.equal(jobs.query.where.status,'published');assert.equal(jobs.query.limit,20001);
 const bounds=Object.getOwnPropertySymbols(jobs.query.where.publishedAt).map(k=>jobs.query.where.publishedAt[k]);assert.equal(bounds[0].toISOString(),'2026-09-30T18:30:00.000Z');assert.equal(bounds[1].toISOString(),'2026-10-31T18:30:00.000Z');
 const posts=calls.find(c=>c.model==='SocialPost');assert.equal(posts.query.where.client,'Brand A');assert.deepEqual([...posts.query.attributes],['id','theme','format']);
});
test('legacy client snapshot responses remove internal metadata without altering stored snapshots',()=>{
 const {reportResponse}=controller(),stored={id:1,kind:'client',client:'Brand A',title:'Brand A report',createdBy:77,brandScope:['Brand A'],data:{kind:'client',totals:{planned:42,overdue:3,published:0},activity:{workflowUpdates:8},people:[{name:'INTERNAL'}],posts:[]}};
 const result=reportResponse({toJSON:()=>stored});assert.equal(result.createdBy,undefined);assert.equal(result.brandScope,undefined);assert.equal(result.data.totals.overdue,undefined);assert.equal(result.data.activity,undefined);assert.equal(stored.data.totals.overdue,3);
 const team={kind:'team',data:{totals:{overdue:3}}};assert.equal(reportResponse(team).data.totals.overdue,3);
});

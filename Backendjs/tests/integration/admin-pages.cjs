/* Page-level API checks. Local fixtures only; never sends mail or publishes posts. */
const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'../../.env')});
if(process.env.FINVERA_INTEGRATION_TESTS!=='1'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST||'localhost'))throw Error('Opt in with FINVERA_INTEGRATION_TESTS=1 and a local DB.');
process.env.JWT_SECRET=process.env.JWT_SECRET||'local-integration-test';
const m=require('../../src/models'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),target=process.argv[2]||'activity';let server;const users=[],logs=[];
(async()=>{try{await m.sequelize.authenticate();await require('../../src/utils/ensureColumns')(m.sequelize);const stamp=Date.now(),label='Admin page test '+stamp;
for(const role of ['admin','graphic'])users.push(await m.User.create({name:label+' '+role,email:role+stamp+'@example.test',password:'not-a-login',role,roles:[role],active:true,socialClients:[]}));const [admin,member]=users;
server=require('../../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
async function req(url,actor=admin,body,method='GET'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+jwt.sign({id:actor.id},process.env.JWT_SECRET,{expiresIn:'5m'})}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
if(target==='activity'){
for(const at of ['2026-10-31T18:29:59Z','2026-10-31T18:30:00Z','2026-11-01T18:29:59Z','2026-11-01T18:30:00Z'])logs.push(await m.ActivityLog.create({userId:admin.id,userName:admin.name,action:'update',entity:'social-post',entityId:'1',entityLabel:label,changes:{caption:['Before','After']},createdAt:new Date(at)}));
assert.equal((await req('/activity',null)).status,401);assert.equal((await req('/activity',member)).status,403);
const q='?q='+encodeURIComponent(label)+'&from=2026-11-01&to=2026-11-01';let r=await req('/activity'+q+'&limit=1&page=1');assert.equal(r.status,200);assert.equal(r.data.total,2);assert.equal(r.data.items.length,1);const second=await req('/activity'+q+'&limit=1&page=2');assert.notEqual(r.data.items[0].id,second.data.items[0].id);
r=await req('/export/activity'+q);assert.equal(r.status,200);assert.equal(r.data.total,2);assert.equal((await req('/export/activity'+q,member)).status,403);
for(const bad of ['?from=2026-02-30','?from=2026-99-01','?from=2026-11-03&to=2026-11-01']){assert.equal((await req('/activity'+bad)).status,400);assert.equal((await req('/export/activity'+bad)).status,400)}
console.log('PASS: Activity admin authorization, IST day boundaries, stable pagination, matching export filters and invalid date rejection. Local DB.');
}else throw Error('Unknown page: '+target);
}finally{if(server)await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,150));for(const row of logs)await row.destroy();for(const u of users){await m.ActivityLog.destroy({where:{userId:u.id}});await m.SecurityEvent.destroy({where:{userId:u.id}});await u.destroy()}await m.sequelize.close()}})().catch(e=>{console.error(e);process.exitCode=1});

/* Local database only: no invitations or email are sent. */
const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'../../.env')});
if(process.env.FINVERA_INTEGRATION_TESTS!=='1')throw Error('Set FINVERA_INTEGRATION_TESTS=1 to run local integration checks.');
if(!['localhost','127.0.0.1'].includes(process.env.DB_HOST||'localhost'))throw Error('Local DB required.');
process.env.JWT_SECRET=process.env.JWT_SECRET||'local-integration-test';
const m=require('../../src/models'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken');let server;const users=[],brands=[];
(async()=>{try{await m.sequelize.authenticate();await require('../../src/utils/ensureColumns')(m.sequelize);
const stamp=Date.now();for(const role of ['admin','graphic'])users.push(await m.User.create({name:'Access test '+role,email:role+stamp+'@example.test',password:'not-a-login',role,roles:[role],active:true,socialClients:[]}));
const [admin,member]=users;const brand=await m.SocialClient.create({name:'Access test '+stamp});brands.push(brand);
// Updating access must not sweep unrelated local fixtures during this test.
require('../../src/controllers/social.controller').assignUnassigned=async()=>{};
server=require('../../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
async function req(url,actor=admin,body,method='GET'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+jwt.sign({id:actor.id},process.env.JWT_SECRET,{expiresIn:'5m'})}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
assert.equal((await req('/users',null)).status,401);assert.equal((await req('/users',member)).status,403);
let got=await req('/users');assert.equal(got.status,200);for(const row of got.data)for(const key of ['password','twoFactorSecret','tokensValidAfter'])assert.equal(key in row,false);
assert.equal((await req('/users/'+admin.id,admin,{roles:['graphic']},'PUT')).status,400);assert.equal((await req('/users/'+admin.id,admin,{active:false},'PUT')).status,400);assert.equal((await req('/users/'+admin.id,admin,null,'DELETE')).status,400);
let updated=await req('/users/'+member.id,admin,{roles:['graphic'],socialClients:[brand.id]},'PUT');assert.equal(updated.status,200);assert.deepEqual(updated.data.socialClients,[String(brand.id)]);
let scoped=await req('/social-reports/options',member);assert.ok(scoped.data.brands.some(b=>b.name===brand.name));
updated=await req('/users/'+member.id,admin,{socialClients:[]},'PUT');assert.equal(updated.status,200);scoped=await req('/social-reports/options',member);assert.ok(!scoped.data.brands.some(b=>b.name===brand.name));
assert.equal((await req('/users/'+member.id,admin,{roles:[]},'PUT')).status,400);
console.log('PASS: admin-only directory, private fields excluded, self-lockout blocked, role validation and brand access changes take effect immediately. Local DB; no email.');
}finally{if(server)await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,150));for(const u of users){await m.ActivityLog.destroy({where:{userId:u.id}});await m.SecurityEvent.destroy({where:{userId:u.id}});await m.Notification.destroy({where:{userId:u.id}});await u.destroy()}for(const b of brands)await b.destroy();await m.sequelize.close()}})().catch(e=>{console.error(e);process.exitCode=1});

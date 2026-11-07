/* Page-level API checks. Local fixtures only; never sends mail or publishes posts. */
const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'../../.env')});
if(process.env.FINVERA_INTEGRATION_TESTS!=='1'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST||'localhost'))throw Error('Opt in with FINVERA_INTEGRATION_TESTS=1 and a local DB.');
process.env.JWT_SECRET=process.env.JWT_SECRET||'local-integration-test';
const m=require('../../src/models'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),target=process.argv[2]||'activity';let server;const users=[],logs=[],settings=[],accounts=[],sessions=[];
(async()=>{try{await m.sequelize.authenticate();await require('../../src/utils/ensureColumns')(m.sequelize);const stamp=Date.now(),label='Admin page test '+stamp;
for(const role of ['admin','graphic'])users.push(await m.User.create({name:label+' '+role,email:role+stamp+'@example.test',password:'not-a-login',role,roles:[role],active:true,socialClients:[]}));const [admin,member]=users;
server=require('../../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
async function req(url,actor=admin,body,method='GET'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+jwt.sign({id:actor.id,...(actor._testJti?{jti:actor._testJti}:{})},process.env.JWT_SECRET,{expiresIn:'5m'})}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
if(target==='activity'){
for(const at of ['2026-10-31T18:29:59Z','2026-10-31T18:30:00Z','2026-11-01T18:29:59Z','2026-11-01T18:30:00Z'])logs.push(await m.ActivityLog.create({userId:admin.id,userName:admin.name,action:'update',entity:'social-post',entityId:'1',entityLabel:label,changes:{caption:['Before','After']},createdAt:new Date(at)}));
assert.equal((await req('/activity',null)).status,401);assert.equal((await req('/activity',member)).status,403);
const q='?q='+encodeURIComponent(label)+'&from=2026-11-01&to=2026-11-01';let r=await req('/activity'+q+'&limit=1&page=1');assert.equal(r.status,200);assert.equal(r.data.total,2);assert.equal(r.data.items.length,1);const second=await req('/activity'+q+'&limit=1&page=2');assert.notEqual(r.data.items[0].id,second.data.items[0].id);
r=await req('/export/activity'+q);assert.equal(r.status,200);assert.equal(r.data.total,2);assert.equal((await req('/export/activity'+q,member)).status,403);
for(const bad of ['?from=2026-02-30','?from=2026-99-01','?from=2026-11-03&to=2026-11-01']){assert.equal((await req('/activity'+bad)).status,400);assert.equal((await req('/export/activity'+bad)).status,400)}
console.log('PASS: Activity admin authorization, IST day boundaries, stable pagination, matching export filters and invalid date rejection. Local DB.');
}else if(target==='settings'){
for(const suffix of ['a','b','private','system'])settings.push(await m.Setting.create({key:'test.'+stamp+'.'+suffix,value:'Original',group:suffix==='system'?'system':'general',isPublic:suffix!=='private'}));
const [a,b,privateRow,internal]=settings;
assert.equal((await req('/settings/all',null)).status,401);assert.equal((await req('/settings/all',member)).status,403);let got=await req('/settings/all');assert.ok(got.data.some(r=>r.key===privateRow.key));assert.ok(!got.data.some(r=>r.key===internal.key));
got=await req('/settings',null);assert.equal(got.data[a.key],'Original');assert.equal(got.data[privateRow.key],undefined);assert.equal(got.data[internal.key],undefined);
assert.equal((await req('/settings',member,{[a.key]:'Denied'},'PUT')).status,403);
got=await req('/settings',admin,[{key:a.key,value:'Would change',expectedValue:'Original'},{key:b.key,value:'Conflict',expectedValue:'Outdated'}],'PUT');assert.equal(got.status,409);assert.equal((await a.reload()).value,'Original');
got=await req('/settings',admin,[{key:a.key,value:'Saved',expectedValue:'Original'},{key:b.key,value:'Saved too',expectedValue:'Original'}],'PUT');assert.equal(got.status,200);assert.equal((await a.reload()).value,'Saved');
assert.equal((await req('/settings',admin,{[a.key]:'Must roll back',google_analytics_id:'<script>'},'PUT')).status,400);assert.equal((await a.reload()).value,'Saved');
assert.equal((await req('/settings',admin,[{key:a.key,value:{nested:'bad'}}],'PUT')).status,400);
got=await req('/settings',admin,{[internal.key]:'Forbidden'},'PUT');assert.equal(got.status,200);assert.equal((await internal.reload()).value,'Original');
got=await req('/settings',null);assert.equal(got.data[a.key],'Saved');
console.log('PASS: Settings permissions, public/private/internal visibility, transactional rollback on stale edits, safe values and cache refresh. Local fixtures only.');
}else if(target==='system'){
for(const [suffix,days]of [['expired',-1],['soon',3],['valid',30]])accounts.push(await m.SocialAccount.create({client:label+' '+suffix,pageId:'test-'+stamp+'-'+suffix,pageName:'Local test',pageToken:'not-a-real-token',status:'connected',tokenExpiresAt:new Date(Date.now()+days*86400000)}));
for(const url of ['/system/status','/backups','/settings/email-status']){assert.equal((await req(url,null)).status,401);assert.equal((await req(url,member)).status,403);assert.equal((await req(url)).status,200)}
const got=await req('/system/status');assert.equal(got.data.db.ok,true);assert.ok(got.data.metaCheck.accounts.needReconnect.includes(label+' expired'));assert.ok(!got.data.metaCheck.accounts.expiringSoon.includes(label+' expired'));assert.ok(got.data.metaCheck.accounts.expiringSoon.includes(label+' soon'));assert.ok(!got.data.metaCheck.accounts.expiringSoon.includes(label+' valid'));for(const secret of ['pageToken','not-a-real-token','SMTP_PASS','JWT_SECRET'])assert.equal(JSON.stringify(got.data).includes(secret),false);
console.log('PASS: System, backup list and email setup are admin-only; status is readable, expired Meta credentials require reconnect, expiry warnings do not double-count and tokens are excluded. Read-only operations; local fixtures.');
}else if(target==='account'){
const bcrypt=require('bcryptjs'),auth=require('../../src/middleware/auth');require('../../src/utils/security').tellUser=()=>{};
await member.update({password:await bcrypt.hash('LocalPassword123',10),mustChangePassword:true});auth.forgetUser(member.id);
for(const [who,tag]of [[member,'current'],[member,'other'],[admin,'admin']])sessions.push(await m.UserSession.create({userId:who.id,jti:stamp+'-'+tag,device:tag,expiresAt:new Date(Date.now()+3600000),lastSeenAt:new Date()}));member._testJti=sessions[0].jti;
assert.equal((await req('/auth/me',null)).status,401);let got=await req('/auth/me',member);assert.equal(got.data.user.id,member.id);for(const key of ['password','twoFactorSecret','twoFactorBackup'])assert.equal(key in got.data.user,false);
got=await req('/auth/me',member,{id:admin.id,name:'My updated name',roles:['admin'],socialClients:[123]},'PUT');assert.equal(got.status,200);assert.equal(got.data.user.name,'My updated name');assert.deepEqual(got.data.user.roles,['graphic']);assert.equal((await admin.reload()).name,label+' admin');
assert.equal((await req('/auth/me',member,{email:'new'+stamp+'@example.test',currentPassword:'incorrect'},'PUT')).status,400);assert.equal((await member.reload()).email,'graphic'+stamp+'@example.test');
got=await req('/auth/sessions',member);assert.equal(got.data.sessions.length,2);assert.ok(got.data.sessions.some(s=>s.id===sessions[0].id&&s.current));assert.ok(!got.data.sessions.some(s=>s.id===sessions[2].id));assert.equal((await req('/auth/sessions/'+sessions[2].id,member,null,'DELETE')).status,404);
const prefsBefore=(await req('/auth/me/email-prefs',admin)).data.prefs;
const results=await Promise.all([req('/auth/me/email-prefs',member,{prefs:{calendar:false}},'PUT'),req('/auth/me/email-prefs',member,{prefs:{contact:false}},'PUT')]);assert.ok(results.every(r=>r.status===200));got=await req('/auth/me/email-prefs',member);assert.equal(got.data.prefs.contact,false);assert.equal(got.data.prefs.calendar,false);assert.deepEqual((await req('/auth/me/email-prefs',admin)).data.prefs,prefsBefore);assert.equal((await req('/auth/me/email-prefs',member,{prefs:{contact:'false'}},'PUT')).status,400);
assert.equal((await req('/auth/change-password',member,{currentPassword:'incorrect',newPassword:'NextPassword456'},'POST')).status,400);
got=await req('/auth/change-password',member,{currentPassword:'LocalPassword123',newPassword:'NextPassword456'},'POST');assert.equal(got.status,200);assert.equal(got.data.sessionsEnded,1);assert.equal((await sessions[0].reload()).revokedAt,null);assert.ok((await sessions[1].reload()).revokedAt);assert.equal((await member.reload()).mustChangePassword,false);assert.ok(await bcrypt.compare('NextPassword456',member.password));assert.equal((await req('/auth/me',member)).status,200);
console.log('PASS: Account own-profile scope, no role escalation, current-password email guard, session ownership, concurrent preference merge, boolean validation and password change signs out other devices while keeping the current session. Local DB; no mail.');
}else throw Error('Unknown page: '+target);
}finally{if(server)await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,150));for(const row of logs)await row.destroy();for(const row of settings)await row.destroy();for(const row of accounts)await row.destroy();for(const row of sessions)await row.destroy();for(const u of users){await m.ActivityLog.destroy({where:{userId:u.id}});await m.SecurityEvent.destroy({where:{userId:u.id}});await m.Notification.destroy({where:{userId:u.id}});await u.destroy()}await m.sequelize.close()}})().catch(e=>{console.error(e);process.exitCode=1});

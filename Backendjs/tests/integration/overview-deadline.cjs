// Run against an isolated local DB: FINVERA_INTEGRATION_TESTS=1 node tests/integration/overview-deadline.cjs
if(process.env.FINVERA_INTEGRATION_TESTS!=='1')throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({path:require('node:path').resolve(__dirname,'../../.env')});
if(!['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST||'localhost'))throw new Error('Use a local test database.');
const assert=require('node:assert/strict');const {sequelize,SocialPost}=require('../../src/models');const {overdueWhere}=require('../../src/utils/socialDeadline');
(async()=>{const client='Overview test '+Date.now();try{await sequelize.authenticate();await SocialPost.bulkCreate([
{client,theme:'Earlier today',status:'production',postDate:'2026-11-05',postTime:'09:00'},
{client,theme:'Later today',status:'production',postDate:'2026-11-05',postTime:'18:00'},
{client,theme:'Default deadline',status:'planned',postDate:'2026-11-05',postTime:null},
{client,theme:'Published',status:'posted',postDate:'2026-11-04',postTime:'09:00'},
{client,theme:'Yesterday',status:'approval',postDate:'2026-11-04',postTime:'09:00'},
]);const count=now=>SocialPost.count({where:{client,...overdueWhere(new Date(now))}});assert.equal(await count('2026-11-05T03:29:59Z'),1);assert.equal(await count('2026-11-05T03:30:00Z'),1);assert.equal(await count('2026-11-05T03:30:00.001Z'),2);assert.equal(await count('2026-11-05T04:30:00.001Z'),3);assert.equal(await count('2026-11-05T12:30:00.001Z'),4);console.log('PASS: scoped Overview/sidebar COUNT queries match exact IST boundaries, default time and published exclusion.');}finally{await SocialPost.destroy({where:{client}});await sequelize.close()}})().catch(e=>{console.error(e);process.exitCode=1});

const {Op}=require('sequelize');
const {sequelize,SocialClient,SocialPost,SocialPublishJob,SocialAccount,SocialStat,SocialPostEvent,SocialReportSnapshot}=require('../models');
const {asyncHandler}=require('../utils/crud'),{periodOf,clientData,csvReport,fail,fingerprint}=require('../utils/socialReports'),{getKpis}=require('./kpi.controller');
const audit=require('../utils/audit');
const names=req=>req.socialScope?[...req.socialScope]:null;
let schema;async function ensure(){if(!schema)schema=SocialReportSnapshot.sync().catch(e=>{schema=null;throw e});await schema;}
async function brand(req,value){if(typeof value!=='string'||!value.trim()||req.socialScope&&!req.socialScope.has(value))throw fail(404,'Client not found.');const item=await SocialClient.findOne({where:{name:value},attributes:['id','name']});if(!item)throw fail(404,'Client not found.');return item.name;}
async function build(req,q){const period=periodOf(q.month);if(q.kind==='client'){
 const client=await brand(req,q.brand);
 return sequelize.transaction(async transaction=>{const options={transaction,raw:true};const [posts,jobs,accounts,followers,events]=await Promise.all([
 SocialPost.findAll({...options,where:{client},attributes:['id','theme','format','status','postDate']}),
 SocialPublishJob.findAll({...options,where:{client,status:'published',publishedAt:{[Op.gte]:period.start,[Op.lt]:period.until}},attributes:['postId','platform','status','publishedAt','metrics','metricsAt','url']}),
 SocialAccount.findAll({...options,where:{client},attributes:['stats','statsAt']}),
 SocialStat.findAll({...options,where:{client,day:{[Op.gte]:new Date(+period.start-45*86400000).toISOString().slice(0,10),[Op.lte]:period.to}},order:[['day','ASC']],attributes:['platform','day','followers']}),
 SocialPostEvent.findAll({...options,where:{client,at:{[Op.gte]:period.start,[Op.lt]:period.until}},attributes:['postId','client','fromStatus','at'],limit:50001})]);
 if(jobs.length>20000||posts.length>50000||events.length>50000)throw fail(413,'This report is too large. Contact an administrator.');return clientData({brand:client,period,posts,jobs,accounts,followers,events});});
 }
 if(q.kind!=='team')throw fail(400,'Choose Team performance or Client report.');
 if(q.brand)await brand(req,q.brand);
 const member=q.personId?Number(q.personId):null;if(member&&!Number.isSafeInteger(member))throw fail(400,'Choose a valid team member.');if(req.socialScope&&member&&member!==req.user.id)throw fail(403,'You can view only your own team report.');
 const k=await getKpis({period:period.month,brand:q.brand||'',scope:req.socialScope,userId:req.user.id,reportDetails:true});
 const people=k.people.filter(p=>(!member||p.id===member)&&(!q.role||p.roles.includes(q.role)));
 const del=people.flatMap(p=>p.completed||[]),dated=del.filter(d=>d.onTime!==null),stages=['planned','client','production','approval','ready'].map(status=>({status,count:people.reduce((n,p)=>n+(p.queue||[]).filter(row=>row.status===status).length,0)}));
 return {kind:'team',generatedAt:new Date().toISOString(),period:{month:period.month,from:period.from,to:period.to,label:period.label,partial:period.partial},historySince:k.historySince,scope:req.socialScope?'own':'team',people,stages,totals:{delivered:del.length,onTime:dated.length?Math.round(1000*dated.filter(d=>d.onTime).length/dated.length)/10:null,dated:dated.length,undated:del.length-dated.length,open:people.reduce((n,p)=>n+p.open,0),overdue:people.reduce((n,p)=>n+p.overdue,0),hours:Math.round(people.reduce((n,p)=>n+p.hours,0)*10)/10}};
}
const options=asyncHandler(async(req,res)=>res.json({brands:await SocialClient.findAll({where:req.socialScope?{name:names(req)}:{},attributes:['id','name','color'],order:[['name','ASC']]}),canSeeTeam:!req.socialScope,userId:req.user.id}));
const preview=asyncHandler(async(req,res)=>{const data=await build(req,req.query);res.set('Cache-Control','no-store').json({...data,fingerprint:fingerprint(data)})});
function canRead(req,item){if(!req.socialScope)return true;let brands=item.brandScope;if(typeof brands==='string'){try{brands=JSON.parse(brands)}catch{return false}}if(!Array.isArray(brands))return false;return item.kind==='client'?req.socialScope.has(item.client):item.audience==='own'&&item.createdBy===req.user.id&&brands.every(name=>req.socialScope.has(name));}
async function load(req){await ensure();const item=await SocialReportSnapshot.findByPk(req.params.id);if(!item||!canRead(req,item))throw fail(404,'Report not found.');return item;}
const list=asyncHandler(async(req,res)=>{await ensure();const where=req.socialScope?{[Op.or]:[{kind:'team',createdBy:req.user.id,audience:'own'},{kind:'client',client:names(req)}]}:{};
 if(req.query.kind){if(!['team','client'].includes(req.query.kind))throw fail(400,'Choose a report type.');where.kind=req.query.kind;}
 if(req.query.month)where.period=periodOf(req.query.month).month;
 if(req.query.brand)where.client=await brand(req,req.query.brand);
 const page=Number(req.query.page||1);if(!Number.isSafeInteger(page)||page<1||page>100)throw fail(400,'Choose a valid report page.');
 const rows=await SocialReportSnapshot.findAll({where,attributes:{exclude:['data']},order:[['createdAt','DESC'],['id','DESC']],limit:2001});const allowed=rows.slice(0,2000).filter(item=>canRead(req,item));res.json({items:allowed.slice((page-1)*20,page*20),page,total:allowed.length,hasMore:page*20<allowed.length,truncated:rows.length>2000});});
const get=asyncHandler(async(req,res)=>res.set('Cache-Control','no-store').json(await load(req)));
function commentary(body){if(body.summary!=null&&(typeof body.summary!=='string'||body.summary.length>5000))throw fail(400,'Use a summary of 5,000 characters or fewer.');return body.summary?.trim()||'';}
const create=asyncHandler(async(req,res)=>{const summary=commentary(req.body),data=await build(req,req.body);if(req.body.expectedFingerprint&&req.body.expectedFingerprint!==fingerprint(data))throw fail(409,'Report data changed since this preview. Refresh and review the numbers before saving.');if(Buffer.byteLength(JSON.stringify(data))>4000000)throw fail(413,'Report exceeds the supported snapshot size.');await ensure();const item=await SocialReportSnapshot.create({audience:data.kind==='client'?'client':data.scope,brandScope:data.client?[data.client]:req.body.brand?[req.body.brand]:names(req)||[],kind:data.kind,client:data.client||req.body.brand||null,period:data.period.month,createdBy:req.user.id,title:`${data.client||(req.body.brand?'Team · '+req.body.brand:'Team')} · ${data.period.label}`.slice(0,255),summary,status:'draft',version:1,data});audit.record(req,{action:'create',entity:'social-report',entityId:item.id,summary:'Saved a report snapshot'});res.status(201).json(item);});
const update=asyncHandler(async(req,res)=>{const summary=commentary(req.body);const item=await load(req);if(!Number.isSafeInteger(req.body.expectedVersion)||req.body.expectedVersion<1)throw fail(400,'Include the saved report revision.');if(req.body.data!==undefined)throw fail(400,'Report data is immutable. Generate a new snapshot to refresh it.');const status=req.body.status;if(status&&!['draft','reviewed'].includes(status))throw fail(400,'Choose Draft or Reviewed.');const saved=await sequelize.transaction(async transaction=>{const row=await SocialReportSnapshot.findByPk(item.id,{transaction,lock:transaction.LOCK.UPDATE});if(row.version!==req.body.expectedVersion)throw fail(409,'This report changed. Reload it before saving.');await row.update({summary:('summary'in req.body)?summary:row.summary,status:status==='reviewed'?'reviewed':('summary'in req.body)&&summary!==row.summary?'draft':status||row.status,version:row.version+1},{transaction});return row;});audit.record(req,{action:'update',entity:'social-report',entityId:saved.id,summary:'Updated report commentary/review status'});res.json(saved);});
const csv=asyncHandler(async(req,res)=>{const item=await load(req);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="finvera-${item.kind}-${item.period}.csv"`,'Cache-Control':'no-store'}).send(csvReport(item));});
module.exports={options,preview,list,get,create,update,csv,build};

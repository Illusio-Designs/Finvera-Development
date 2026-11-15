const {Op,fn,col,where}=require('sequelize');
const models=require('../models');
const {asyncHandler}=require('../utils/crud');
const {rolesCan,rolesOf,ROLE_AREAS}=require('../utils/permissions');
const {fail,email,phone,literalLike,duplicateReason}=require('../utils/workspaceTools');
const duplicates=asyncHandler(async(req,res)=>{
 const input=Object.fromEntries(['email','phone','name','company','exclude'].map(k=>[k,String(req.query[k]||'').slice(0,255)])),conditions=[];
 if(email(input.email))conditions.push(where(fn('LOWER',col('email')),email(input.email)));
 if(phone(input.phone).length>=7){let normalized=col('phone');for(const char of [' ','-','+','(',')','.'])normalized=fn('REPLACE',normalized,char,'');conditions.push(where(normalized,{[Op.like]:'%'+literalLike(phone(input.phone))}));}
 if(!conditions.length&&input.name&&input.company)conditions.push({[Op.and]:[where(fn('LOWER',col('name')),email(input.name)),where(fn('LOWER',col('company')),email(input.company))]});
 if(!conditions.length)return res.json({items:[]});
 const rows=await models.Lead.findAll({where:{[Op.or]:conditions},attributes:['id','name','company','email','phone','stage','owner'],limit:50,raw:true});
 res.set('Cache-Control','no-store').json({items:rows.map(r=>({...r,reason:duplicateReason(r,input)})).filter(r=>r.reason).slice(0,10)});
});
const search=asyncHandler(async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,80);if(q.length<2)return res.json({items:[]});const roles=rolesOf(req.user),items=[],term='%'+literalLike(q)+'%';
 const find=async(Model,fields,attributes,extra={})=>Model.findAll({where:{...extra,[Op.or]:fields.map(k=>({[k]:{[Op.like]:term}}))},attributes,order:[['id','DESC']],limit:6,raw:true});
 if(rolesCan(roles,'leads'))for(const r of await find(models.Lead,['name','company','email'],['id','name','company','stage']))items.push({kind:'Leads',label:r.name,sub:[r.company,r.stage].filter(Boolean).join(' · '),href:'/dashboard/leads?lead='+r.id});
 if(rolesCan(roles,'renewals'))for(const r of await find(models.Renewal,['client','project'],['id','client','project','status']))items.push({kind:'Renewals',label:r.client,sub:[r.project,r.status].filter(Boolean).join(' · '),href:'/dashboard/renewals?renewal='+r.id});
 if(rolesCan(roles,'social')){const scope=require('./social.controller');const ids=scope.brandIdsOf(req.userRow||await require('../middleware/auth').loadUser(req.user.id));const names=ids===null?null:await scope.brandNames(ids);const filter=names?{name:{[Op.in]:names}}:{};for(const r of await find(models.SocialClient,['name'],['id','name'],filter))items.push({kind:'Clients',label:r.name,sub:'Brand workspace',href:'/dashboard/social-studio?brand='+encodeURIComponent(r.name)});}
 if(rolesCan(roles,'content'))for(const [model,route,fields] of [[models.Project,'projects',['title']],[models.BlogPost,'blog',['title']],[models.Page,'pages',['title']],[models.Service,'services',['title']]])for(const r of await find(model,fields,['id','title','status']))items.push({kind:'Content',label:r.title,sub:route+' · '+r.status,href:'/dashboard/'+route+'?q='+encodeURIComponent(r.title)});
 res.set('Cache-Control','no-store').json({items:items.slice(0,36)});
});
const access=asyncHandler(async(req,res)=>res.json({roles:Object.entries(ROLE_AREAS).map(([role,areas])=>({role,areas:areas==='*'?['content','leads','contact','seo','settings','users','renewals','social']:areas})),notes:['The API checks every protected action.','Social records are additionally restricted to assigned brands.','Security alerts cannot be muted.']}));
module.exports={duplicates,search,access};

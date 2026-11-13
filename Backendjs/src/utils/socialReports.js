const count = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const obj = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };
const fail = (status, message) => Object.assign(new Error(message), {status,statusCode:status});
function periodOf(month, now = new Date()) {
 const today = new Date(+now + 330*60000).toISOString().slice(0,10), current=today.slice(0,7);
 const value=month || current;
 if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value) || value>current) throw fail(400,'Choose a valid current or past reporting month.');
 const [y,m]=value.split('-').map(Number), from=value+'-01', end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10), to=end<today?end:today;
 return {month:value,from,to,end,label:new Date(from+'T00:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}),start:new Date(from+'T00:00:00+05:30'),until:new Date(+new Date(to+'T00:00:00+05:30')+86400000),partial:to<end};
}
function metricSummary(jobs) {
 const fields=['likes','comments','shares'];const totals={},coverage={};
 for(const field of fields){const values=jobs.map(j=>obj(j.metrics)[field]).filter(count);totals[field]=values.length?values.reduce((a,b)=>a+b,0):null;coverage[field]=values.length;}
 const present=fields.map(f=>totals[f]).filter(count);
 return {...totals,interactions:present.length?present.reduce((a,b)=>a+b,0):null,coverage,reportedPosts:jobs.filter(j=>fields.some(f=>count(obj(j.metrics)[f]))).length};
}
function postUrl(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&['instagram.com','facebook.com','fb.watch'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))&&![...url.searchParams.keys()].some(key=>/token|secret|authorization/i.test(key))?url.href:null;}catch{return null;}}
function pictureUrl(value){try{const url=new URL(value);const own=new URL(process.env.PUBLIC_URL||'https://api.finvera.solutions').hostname;return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&[own,'fbcdn.net','cdninstagram.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))&&![...url.searchParams.keys()].some(key=>/token|secret|authorization/i.test(key))?url.href:null;}catch{return null;}}
function contentActivity(events, brand, period) {
 if (!Array.isArray(events)) return null;
 const rows=events.filter(e=>e.client===brand&&new Date(e.at)>=period.start&&new Date(e.at)<period.until);
 const created=rows.filter(e=>e.fromStatus==null),updates=rows.filter(e=>e.fromStatus!=null);
 const days=new Map();for(const e of rows){const day=new Date(+new Date(e.at)+330*60000).toISOString().slice(0,10);const row=days.get(day)||{day,created:0,updates:0};row[e.fromStatus==null?'created':'updates']++;days.set(day,row);}
 return {created:created.length,workflowUpdates:updates.length,updatedPosts:new Set(updates.map(e=>e.postId)).size,daily:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)),basis:'Recorded calendar creation and workflow events in this month, in India time. Reassignments count as updates. Text-only edits and unrecorded historical activity are not included.'};
}
function clientData({brand,period,posts,jobs,accounts,followers,events,now=new Date()}) {
 const published=jobs.filter(j=>j.status==='published'&&j.publishedAt&&new Date(j.publishedAt)>=period.start&&new Date(j.publishedAt)<period.until);
 const unique=new Map();for(const job of published){const key=`${job.postId}|${job.platform}`;if(!unique.has(key)||new Date(job.publishedAt)>new Date(unique.get(key).publishedAt))unique.set(key,job);}
 const rows=[...unique.values()],byPost=new Map(posts.map(p=>[p.id,p])),metrics=metricSummary(rows);
 const channels=['instagram','facebook'].map(platform=>{const own=rows.filter(j=>j.platform===platform),f=followers.filter(s=>s.platform===platform&&count(s.followers)),baseline=f.filter(s=>s.day<period.from).at(-1),end=f.filter(s=>s.day>=period.from&&s.day<=period.to).at(-1),acc=accounts[0],profile=obj(acc?.stats)[platform]||{};return {platform,publications:own.length,followers:count(profile.followers)?profile.followers:null,followerChange:baseline&&end?end.followers-baseline.followers:null,baselineDay:baseline?.day||null,latestDay:end?.day||null,metrics:metricSummary(own)};});
 const dates=rows.map(j=>j.metricsAt).filter(Boolean).map(d=>+new Date(d));
 return {kind:'client',client:brand,activity:contentActivity(events,brand,period),period:{month:period.month,from:period.from,to:period.to,label:period.label,partial:period.partial},generatedAt:now.toISOString(),totals:{planned:posts.filter(p=>p.postDate>=period.from&&p.postDate<=period.to).length,published:new Set(rows.map(j=>j.postId)).size,publications:rows.length,manuallyMarked:posts.filter(p=>p.status==='posted'&&p.postDate>=period.from&&p.postDate<=period.to&&!rows.some(j=>j.postId===p.id)).length,...metrics,reach:null},channels,refreshedAt:dates.length?new Date(Math.max(...dates)).toISOString():null,coverage:{publicationRows:rows.length,reportedRows:metrics.reportedPosts,metricTimeBasis:'Latest provider totals on posts published in this period; not interactions earned only during the period.',unsupported:['reach','impressions','watchTime','storyInsights']},posts:rows.map(j=>{const p=byPost.get(j.postId);return {id:j.postId,channel:j.platform,title:p?.theme||'Published post',format:p?.format||null,publishedAt:j.publishedAt,url:postUrl(j.url),picture:pictureUrl(obj(j.metrics).picture),...metricSummary([j]),metricsAt:j.metricsAt||null};})};
}
function csvCell(value) {let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csvReport(report) {
 const data=report.data||report;
 const header=data.kind==='team'?['Member','Role','Recorded assignments','Completed','On time %','Open now','Overdue now','Hours']:['Content','Channel','Format','Published','Likes','Comments','Shares','Reported interactions'];
 const rows=data.kind==='team'?data.people.map(p=>[p.name,p.role,p.assigned??'Not available',p.delivered,p.onTime??'Not available',p.open,p.overdue,p.hours]):data.posts.map(p=>[p.title,p.channel,p.format,p.publishedAt,p.likes??'Not available',p.comments??'Not available',p.shares??'Not available',p.interactions??'Not available']);
 if(data.kind==='client'&&data.activity){rows.push([],['Monthly content activity','Count'],['Content created',data.activity.created],['Posts with workflow updates',data.activity.updatedPosts],['Workflow updates',data.activity.workflowUpdates],['Coverage',data.activity.basis],[],['Date IST','Created','Workflow updates'],...data.activity.daily.map(day=>[day.day,day.created,day.updates]));}
 return '\ufeff'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
function fingerprint(data){const {generatedAt,fingerprint,...stable}=data;return require('crypto').createHash('sha256').update(JSON.stringify(stable)).digest('hex');}
module.exports={fingerprint,periodOf,metricSummary,clientData,csvReport,fail,obj,count,contentActivity};

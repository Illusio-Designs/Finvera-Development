const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
process.env.NODE_ENV='test';
test('browser WebP variants preserve original publishing bytes, alpha, animation and cache freshness',async()=>{
 const root=path.resolve(__dirname,'../uploads'),key='image-display-test-'+Date.now(),dir=path.join(root,key),social=path.join(root,'social',key+'.jpg'),cacheFiles=new Set();let server;
 async function cacheFor(file){const stat=await fs.stat(file);cacheFiles.add(path.join(root,'.webp-cache',crypto.createHash('sha256').update(`${file}|${stat.size}|${stat.mtimeMs}`).digest('hex')+'.webp'));}
 try{
  await fs.mkdir(dir,{recursive:true});await fs.mkdir(path.dirname(social),{recursive:true});
  const jpeg=await sharp({create:{width:32,height:20,channels:3,background:'#4b6bb2'}}).jpeg({progressive:true}).toBuffer(),png=await sharp({create:{width:16,height:16,channels:4,background:{r:255,g:0,b:0,alpha:.3}}}).png().toBuffer();
  const animated=Buffer.from('47494638396101000100800000ff00000000ff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b','hex');assert.equal((await sharp(animated,{animated:true}).metadata()).pages,2);
  const files={'image.jpg':jpeg,'alpha.png':png,'animated.gif':animated,'logo.svg':Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>')};
  for(const[name,data]of Object.entries(files)){await fs.writeFile(path.join(dir,name),data);await cacheFor(path.join(dir,name));}await fs.writeFile(social,jpeg);await cacheFor(social);const socialCache=[...cacheFiles].at(-1);
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/uploads/`;
  async function get(file,accept='image/webp,image/*;q=0.8,*/*;q=0.5'){const r=await fetch(base+file,{headers:{Accept:accept}});return{status:r.status,type:r.headers.get('content-type'),vary:r.headers.get('vary'),data:Buffer.from(await r.arrayBuffer())};}
  let image=await get(key+'/image.jpg');assert.equal(image.status,200);assert.ok(image.type.startsWith('image/webp'));assert.ok(image.vary.includes('Accept'));assert.equal((await sharp(image.data).metadata()).format,'webp');
  assert.deepEqual((await get(key+'/image.jpg','*/*')).data,jpeg);assert.deepEqual((await get(key+'/image.jpg','image/webp;q=0,image/jpeg')).data,jpeg);
  image=await get(key+'/alpha.png');const alpha=await sharp(image.data).metadata();assert.equal(alpha.hasAlpha,true);assert.equal(alpha.format,'webp');
  assert.deepEqual((await get(key+'/animated.gif')).data,animated);assert.deepEqual((await get(key+'/logo.svg')).data,files['logo.svg']);
  assert.deepEqual((await get('social/'+key+'.jpg')).data,jpeg);assert.equal((await sharp((await get('social/'+key+'.jpg?display=webp')).data).metadata()).format,'webp');assert.deepEqual((await get('social/'+key+'.jpg?display=webp','*/*')).data,jpeg);
  const parallel=await Promise.all(Array.from({length:5},()=>get(key+'/image.jpg')));assert.ok(parallel.every(r=>r.status===200&&r.type.startsWith('image/webp')));
  assert.deepEqual(await fs.readFile(path.join(dir,'image.jpg')),jpeg);assert.deepEqual(await fs.readFile(social),jpeg);
  await fs.writeFile(path.join(dir,'image.jpg'),await sharp({create:{width:48,height:24,channels:3,background:'green'}}).jpeg().toBuffer());await cacheFor(path.join(dir,'image.jpg'));assert.equal((await sharp((await get(key+'/image.jpg')).data).metadata()).width,48);
  const direct=await fetch(base.replace(/\/uploads\/$/,'')+'/api/image-display?file='+encodeURIComponent('/uploads/social/'+key+'.jpg'),{headers:{Accept:'image/webp'}});assert.equal(direct.status,200);assert.equal((await sharp(Buffer.from(await direct.arrayBuffer())).metadata()).format,'webp');
  for(const file of ['https://example.test/logo.jpg','/uploads/../secret.jpg','/uploads/.webp-cache/test.jpg']){const denied=await fetch(base.replace(/\/uploads\/$/,'')+'/api/image-display?file='+encodeURIComponent(file),{headers:{Accept:'image/webp'}});assert.equal(denied.status,400);}
  const head=await fetch(base+key+'/alpha.png',{method:'HEAD',headers:{Accept:'image/webp'}});assert.equal(head.status,200);assert.ok(head.headers.get('content-type').startsWith('image/webp'));
  const priorPurge=process.env.SOCIAL_PURGE_AFTER_PUBLISH;try{process.env.SOCIAL_PURGE_AFTER_PUBLISH='true';const post={media:[{url:'https://example.test/uploads/social/'+key+'.jpg'}],async update(patch){Object.assign(this,patch)}};assert.equal(await require('../src/utils/purgeMedia').purgeMedia(post),1);await assert.rejects(fs.access(socialCache));await assert.rejects(fs.access(social));}finally{if(priorPurge===undefined)delete process.env.SOCIAL_PURGE_AFTER_PUBLISH;else process.env.SOCIAL_PURGE_AFTER_PUBLISH=priorPurge;}
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});await fs.rm(social,{force:true});for(const file of cacheFiles)await fs.rm(file,{force:true});}
});

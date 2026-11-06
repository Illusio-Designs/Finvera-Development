const { test } = require('node:test'), assert = require('node:assert/strict');
const { publishFacebookFormat } = require('../src/utils/socialMetaFormats');
const { preflight } = require('../src/utils/socialPreflight');
const { contentHash, prepareUpdate, liveLink } = require('../src/utils/socialSafety');
const { mergeProfileStats } = require('../src/utils/profilePictures');
const video = { url: 'https://example.test/video.mp4', type: 'video', coverUrl: 'https://example.test/cover.jpg' };
function facebook(format, media, cp = {}, overrides = {}) {
 const calls = [], saved = [];
 const api = { isVideo: item => item.type === 'video', graph: async (method, path, params) => {
  calls.push({ method, path, params });
  if (params.upload_phase === 'start') return { video_id: 'video-1', upload_url: 'https://rupload.facebook.com/video-upload/v26.0/video-1' };
  if (path.endsWith('/photos')) return { id: 'photo-1' };
  if (path.endsWith('/photo_stories')) return { success: true, post_id: 'story-1' };
  if (params.fields === 'status') return { status: { uploading_phase: { status: 'complete' } } };
  return params.upload_phase === 'finish' ? { success: true, post_id: 'published-1' } : { permalink_url: 'https://www.facebook.com/reel/published-1' };
 }, uploadHosted: async () => calls.push({ upload: true }), waitForVideo: async () => {}, waitForPublished: async () => {}, uploadCover: async () => calls.push({ cover: true }), ...overrides };
 return { calls, saved, cp, run: () => publishFacebookFormat({ page: 'page-1', token: 'test-token', media, caption: 'Saved caption', format, checkpoint: cp, save: async value => saved.push(JSON.parse(JSON.stringify(value))) },api) };
}
test('Facebook photo Stories stage the photo then publish a Story, without a feed caption', async () => {
 const x = facebook('Story', [{ type: 'image', url: 'https://example.test/image.jpg' }]); await x.run();
 assert.equal(x.calls.filter(call => call.path?.endsWith('/photos')).length,1); assert.equal(x.calls.filter(call => call.path?.endsWith('/photo_stories')).length,1);
 assert.equal(x.calls.some(call => call.path?.endsWith('/feed')),false); assert.ok(x.saved.find(cp => cp.photoId && !cp.publishCalled)); assert.equal(x.cp.publishCalled,true);
});
test('Facebook video Stories and Reels use different finish endpoints and covers only attach to Reels', async () => {
 for (const format of ['Video Story','Reel']) {
  const x = facebook(format, [video]); await x.run();
  const finish = x.calls.find(call => call.params?.upload_phase === 'finish');
  assert.ok(finish.path.endsWith(format === 'Reel' ? '/video_reels' : '/video_stories'));
  assert.equal(finish.params.description,format === 'Reel' ? 'Saved caption' : undefined);
  assert.equal(x.calls.some(call => call.cover),format === 'Reel');
  assert.ok(x.saved.some(cp => cp.videoId && !cp.publishCalled));
 }
});
test('safe Facebook retries resume an uploaded video without allocating another video or uploading again', async () => {
 const x = facebook('Reel',[video],{ videoId: 'saved-video', uploadUrl:'https://rupload.facebook.com/video-upload/v26.0/saved-video', uploaded: true, coverUploaded: true }); await x.run();
 assert.equal(x.calls.some(call => call.params?.upload_phase === 'start' || call.upload || call.cover),false);
});
test('cover permission failures retain a confirmed live result; final-write failures remain uncertain', async () => {
 const cover = facebook('Reel',[video],{}, { uploadCover: async () => { const error = new Error('Permission denied'); error.meta={code:200}; throw error; } });
 await assert.rejects(cover.run(), error => error.publishStage === 'cover'); assert.equal(cover.cp.publishCalled,true);assert.equal(cover.cp.publishedConfirmed,true);assert.equal(cover.cp.coverPending,true);
 const resume=facebook('Reel',[video],cover.cp);await resume.run();assert.equal(resume.calls.some(call=>call.params?.upload_phase==='finish'),false);assert.equal(resume.calls.some(call=>call.cover),true);assert.equal(resume.cp.coverPending,false);
 const final = facebook('Reel',[video],{}, { waitForPublished: async () => { throw new Error('Not confirmed'); } });
 await assert.rejects(final.run(),/Not confirmed/); assert.equal(final.cp.publishCalled,true);
});
test('Stories validate single assets; covers are reviewed content and invalidate approval', () => {
 const post={id:1,status:'ready',assigneeId:2,format:'Reel',postDate:'2026-11-10',media:[video]};
 assert.deepEqual(preflight({...post,format:'Story',tags:'',media:[{type:'image',url:'https://example.test/photo.jpg'}]}),[]);
 assert.ok(preflight({...post,format:'Story'}).some(issue=>/Cover images/.test(issue.message)));
 const media=[{...video,coverUrl:'https://example.test/other.jpg'}]; assert.notEqual(contentHash(post),contentHash({...post,media}));
 assert.equal(prepareUpdate(post,{media},{id:2,roles:['social']},[]).status,'approval');
 assert.throws(()=>prepareUpdate(post,{media},{id:2,roles:['social']},[{platform:'facebook',status:'published'}]),/already be live/);
 assert.ok(liveLink('https://www.instagram.com/stories/brand/12345/','instagram'));
});
test('failed or partial profile reads keep the last successful channel picture and metrics', () => {
 const result=mergeProfileStats({facebook:{followers:42,picture:'https://example.test/old.jpg'},instagram:{followers:50,picture:'https://example.test/ig.jpg'}},{facebook:{followers:null,picture:'https://example.test/new.jpg'}});
 assert.equal(result.facebook.followers,42);assert.equal(result.facebook.picture,'https://example.test/new.jpg');assert.equal(result.instagram.followers,50);
});
async function instagram(media,format) {
 const https=require('node:https'),{EventEmitter}=require('node:events'),meta=require('../src/utils/meta'),original=https.request,calls=[];
 https.request=(opts,cb)=>{ const request=new EventEmitter();let body='';request.write=chunk=>{body+=chunk};request.end=()=>{const params=new URLSearchParams(body);calls.push({path:opts.path,params});const data=opts.method==='POST'?{id:opts.path.includes('media_publish')?'published':'container'}:opts.path.includes('status_code')?{status_code:'FINISHED'}:{};queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;cb(res);res.emit('data',JSON.stringify(data));res.emit('end')})};return request;};
 try { await meta.publishInstagram({igUserId:'ig',pageToken:meta.encrypt('test-only')},media,'Private notes',{},async()=>{},'',{format});return calls; } finally {https.request=original;}
}
test('actual Instagram publisher sends Stories and Reel cover_url parameters correctly',async()=>{
 const stories=await instagram([{type:'image',url:'https://example.test/photo.jpg'}],'Story');
 const container=stories.find(call=>call.params.has('image_url'));assert.equal(container.params.get('media_type'),'STORIES');assert.equal(container.params.has('caption'),false);
 const reels=await instagram([video],'Reel');assert.equal(reels.find(call=>call.params.has('video_url')).params.get('cover_url'),video.coverUrl);
});
test('actual cover upload sends multipart JPEG bytes and refuses external files or upload destinations',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),https=require('node:https'),{EventEmitter}=require('node:events'),uploads=require('../src/utils/metaUploads');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'finvera-cover-'));await fs.mkdir(path.join(folder,'social'));await fs.writeFile(path.join(folder,'social','cover.jpg'),Buffer.from([255,216,255,10,11]));
 const options={publicUrl:'https://media.example.test',uploadDir:folder},original=https.request;let captured;
 https.request=(url,config,callback)=>{const req=new EventEmitter();req.end=body=>{captured={url,config,body};queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;callback(res);res.emit('data','{"success":true}');res.emit('end')})};return req;};
 try{
  await assert.rejects(uploads.coverBytes('https://other.example.test/cover.jpg',options),/inside Finvera/);
  await assert.rejects(uploads.uploadHosted('https://attacker.test/video-upload/id','https://media.example.test/a.mp4','token'),/invalid video upload/);
  await uploads.uploadCover('video-1','https://media.example.test/uploads/social/cover.jpg','test-only','https://graph.facebook.com/v26.0',options);
  assert.equal(captured.url.pathname,'/v26.0/video-1/thumbnails');assert.ok(captured.config['headers']['Content-Type'].startsWith('multipart/form-data'));assert.ok(captured.body.includes(Buffer.from([255,216,255,10,11])));assert.ok(captured.body.toString().includes('name="is_preferred"'));
  await uploads.uploadHosted('https://rupload.facebook.com/video-upload/v26.0/video-1','https://media.example.test/a.mp4','test-only');assert.equal(captured.config.headers.file_url,'https://media.example.test/a.mp4');
 }finally{https.request=original;await fs.rm(folder,{recursive:true,force:true})}
});

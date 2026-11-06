const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Story and cover JPEG preparation preserves vertical artwork instead of applying feed borders',async()=>{
 const context={exports:{},File,Blob,URL,setTimeout,createImageBitmap:async()=>({width:1080,height:1920}),document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['jpeg'],{type:'image/jpeg'}))})}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/igImage.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 const file=new File(['image'],'story.jpg',{type:'image/jpeg'});
 const story=await context.exports.instagramSafe(file,'preserve');assert.equal(story.changed,false);assert.equal(story.file,file);
 const feed=await context.exports.instagramSafe(file,'feed');assert.equal(feed.changed,true);assert.match(feed.note,/white borders/);
});

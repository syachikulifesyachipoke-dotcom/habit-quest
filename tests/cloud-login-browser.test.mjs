import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const binary=['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .map(name=>spawnSync('which',[name],{encoding:'utf8'}))
 .find(x=>x.status===0)?.stdout.trim();
const remote={
 habitSchemaVersion:2,xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',icon:'bookopen',target:3,ouraTrackingOnly:false,missionEnabled:true,
  createdOn:'2026-11-23',targetHistory:[{effectiveOn:'2026-11-23',target:3,mission:true}],
  activeIntervals:[{from:'2026-11-23',until:null}]}],
 checks:{'2026-11-23':{read:true}},rewardedWeeks:[],ouraAutoEnabled:true,ouraTrackingVersion:3,
 ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:['oura_dance','oura_pilates']
};
const fakeCloudScript=`<script>
window.__testErrors=[];
window.addEventListener('error',e=>window.__testErrors.push('error: '+e.message));
window.addEventListener('unhandledrejection',e=>window.__testErrors.push('rejection: '+e.reason?.message));
window.supabase={};
window.supabase.createClient=function(){
 const client={};
 client.auth={};
 client.auth.onAuthStateChange=function(){return {data:{subscription:{unsubscribe:function(){}}}}};
 client.auth.getSession=async function(){
   return {data:{session:{user:{id:'test-account',email:'test@example.invalid'}}},error:null};
 };
 client.auth.getUser=async function(){
   return {data:{user:{id:'test-account',email:'test@example.invalid'}},error:null};
 };
 client.from=function(){
   return {
     select:function(){
       return {eq:function(){
         return {maybeSingle:async function(){
           return {data:{data:${JSON.stringify(remote)},revision:12},error:null};
         }};
       }};
     }
   };
 };
 client.functions={invoke:async function(){return {data:{},error:null}}};
 return client;
};
</script>`;
// Catch fixture parsing issues before invoking headless Chrome.
assert.doesNotThrow(()=>new vm.Script(fakeCloudScript.slice('<script>'.length,-'</script>'.length),{filename:'fake-supabase-sdk.js'}));
const prelude=`<script>
(()=>{
 if(!new URLSearchParams(location.search).has('conflictingPhone'))return;
 const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 localStorage.setItem('habit-quest-v1',JSON.stringify({
  xpStartDate:today,habits:[{id:'read',name:'読書',icon:'bookopen',target:7,
   createdOn:today,targetHistory:[{effectiveOn:today,target:7,mission:true}],
   activeIntervals:[{from:today,until:null}]}],
  checks:{[today]:{read:true}},rewardedWeeks:[],ouraAutoEnabled:true,ouraTrackingVersion:3,
  ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:[]
 }));
})();
</script>`;
const check=`<script>
(async()=>{try{
 await new Promise(resolve=>setTimeout(resolve,400));
 const verify=(yes,msg)=>{if(!yes)throw Error(msg)};
 const blocked=new URLSearchParams(location.search).has('conflictingPhone');
 const saved=JSON.parse(localStorage.getItem('habit-quest-v1'));
 verify(!!saved,'phone local state absent; mock SDK: '+Boolean(window.supabase?.createClient)+'; config: '+window.HABIT_QUEST_CLOUD?.url+'; game date: '+document.getElementById('nowDate').textContent+'; status: '+document.getElementById('cloudStatus').textContent+'; errors: '+JSON.stringify(window.__testErrors));
 const reading=saved.habits.find(h=>h.id==='read');
 verify(!!reading,'reading habit disappeared');
 if(blocked){
  verify(reading.target===7,'local edited habit overwritten without consent');
  verify(!document.getElementById('syncBanner').hidden,'conflict not visible');
  verify(document.getElementById('cloudToggle').textContent.includes('要確認'),'conflict indicator missing');
 }else{
  verify(reading.target===3,'remote PC goal not adopted by fresh phone');
  verify(saved.checks['2026-11-23'].read===true,'remote checks not imported');
  verify(saved.xpStartDate==='2026-11-23','cloud XP anchor lost');
  verify(document.getElementById('syncBanner').hidden,'pristine phone showed false conflict');
  verify(document.getElementById('cloudToggle').textContent.includes('保存済'),'cloud not ready after import');
 }
 document.body.setAttribute('data-cloud-login-flow','PASS');
}catch(error){document.body.setAttribute('data-cloud-login-flow','FAIL '+String(error.message).replace(/["<>]/g,''))}})();
</script>`;
test('Chrome simulated Supabase Auth login: pristine phone auto-syncs, edited phone blocks overwrite',{timeout:42000},async t=>{
 if(!binary){
  if(process.env.CI)assert.fail('No Chrome binary on CI');
  t.skip('No local Chrome');return;
 }
 const raw=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=raw.replace('<script src="./cloud-config.js"></script>',prelude+fakeCloudScript+'<script src="./cloud-config.js"></script>')
  .replace('</body>',check+'</body>');
 assert.notEqual(raw,app);
 const resources=new Map([['/index.html',app],
  ['/cloud-config.js','window.HABIT_QUEST_CLOUD={url:"https://test.supabase.co",anonKey:"sb_publishable_mock"};']]);
 for(const file of ['goal-metrics.js','habit-lifecycle.js','sync-guard.js','sync-merge.js','daily-adventure.js',
    'adventure-world.js','cloud-onboarding.js','game-shell.js','game-shell.css','coin-shop.js','coin-shop.css']){
  resources.set('/'+file,fs.readFileSync(path.join(root,file),'utf8'));
 }
 const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!resources.has(pathname)){response.writeHead(404);response.end();return}
  const type=pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':'text/javascript';
  response.writeHead(200,{'Content-Type':type+'; charset=utf-8'});
  response.end(resources.get(pathname));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const suffix of ['','?conflictingPhone=1']){
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'habit-cloud-login-'));
   let stdout='',stderr='';
   try{
    const target='http://127.0.0.1:'+server.address().port+'/index.html'+suffix;
    const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
      '--disable-background-networking','--user-data-dir='+profile,'--window-size=500,844',
      '--virtual-time-budget=2500','--dump-dom',target];
    const p=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>stdout+=d.toString());
    p.stderr.on('data',d=>stderr+=d.toString());
    const killer=setTimeout(()=>p.kill('SIGKILL'),29000);
    const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',resolve)});
    clearTimeout(killer);
    assert.equal(code,0,stderr.slice(-600));
    const marker=stdout.match(/data-cloud-login-flow="([^"]+)"/);
    assert.ok(marker,'Cloud login harness did not finish '+suffix+' '+stdout.slice(-650));
    assert.equal(marker[1],'PASS',suffix+' integration failed');
   }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2})}
  }
 }finally{server.close()}
});

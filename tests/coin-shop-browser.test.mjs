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
const chrome=['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .map(x=>spawnSync('which',[x],{encoding:'utf8'})).find(x=>x.status===0)?.stdout.trim();
const remote={
 habitSchemaVersion:2,xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',icon:'bookopen',target:5,ouraTrackingOnly:false,missionEnabled:true,
  createdOn:'2026-11-23',activeIntervals:[{from:'2026-11-23',until:null}],targetHistory:[{effectiveOn:'2026-11-23',target:5,mission:true}]}],
 checks:{},rewardedWeeks:[],ouraAutoEnabled:true,ouraTrackingVersion:3,
 ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:['oura_dance','oura_pilates']
};
const fakeSdk=`<script>
window.__coinTest={coins:255,items:[],equipped:null,gachaUsed:false,drawCount:0};
window.__bootErrors=[];
window.addEventListener('error',e=>window.__bootErrors.push('error:'+e.message));
window.addEventListener('unhandledrejection',e=>window.__bootErrors.push('rejection:'+e.reason?.message));
window.supabase={};
window.supabase.createClient=function(){
 const client={};
 client.auth={};
 client.auth.onAuthStateChange=function(){return {data:{subscription:{unsubscribe:function(){}}}}};
 client.auth.getSession=async function(){
  return {data:{session:{user:{id:'test-player',email:'user@example.invalid'}}},error:null};
 };
 client.auth.getUser=async function(){
  return {data:{user:{id:'test-player',email:'user@example.invalid'}},error:null};
 };
 client.from=function(){return{select:function(){return{eq:function(){return{
  maybeSingle:async function(){return{data:{data:${JSON.stringify(remote)},revision:2},error:null};}
 }}}}}};
 client.rpc=async function(name,args){
  if(name!=='hq_game_action')return {error:{message:'unexpected rpc'}};
  const s=window.__coinTest,action=args.p_action,item=args.p_item_id;
  const prices={cloak:60,lantern:100,crown:140,aura:200,wings:280};
  let event=null;
  if(action==='buy'){
   if(s.items.includes(item)||s.coins<prices[item])return{error:{message:'bad purchase'}};
   s.coins-=prices[item];s.items.push(item);event={type:'buy',itemId:item,price:prices[item]};
  }
  if(action==='equip'){
   if(!s.items.includes(item))return{error:{message:'not owned'}};
   s.equipped=item;event={type:'equip',itemId:item};
  }
  if(action==='draw'){
   if(s.gachaUsed)return{error:{message:'Daily free draw already used'}};
   s.gachaUsed=true;s.drawCount++;
   const duplicate=s.items.includes('cloak');
   if(duplicate)s.coins+=15;else s.items.push('cloak');
   event={type:'draw',itemId:'cloak',duplicate,refund:duplicate?15:0};
  }
  return {data:{coins:s.coins,items:s.items,equipped:s.equipped,gachaUsed:s.gachaUsed,
   gameDay:'2026-11-23',yesterday:'2026-11-22',yesterdayChecks:2,yesterdayCoins:10,
   earnedNow:0,event},error:null};
 };
 client.functions={invoke:async function(){return{data:{},error:null}}};
 return client;
};
</script>`;
// Validate mocked cloud SDK before browser simulation; syntax errors must not masquerade as product bugs.
assert.doesNotThrow(()=>new vm.Script(fakeSdk.slice('<script>'.length,-'</script>'.length),{filename:'coin-cloud-fixture.js'}));
const check=`<script>
(async()=>{try{
 const requireOk=(yes,label)=>{if(!yes)throw Error(label)};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,160));
 for(let i=0;i<12&&!localStorage.getItem('habit-quest-v1');i++)await pause();
 const saved=localStorage.getItem('habit-quest-v1');
 requireOk(!!saved,'fresh login did not import cloud state; status:'+document.getElementById('cloudStatus').textContent+'; boot:'+JSON.stringify(window.__bootErrors));
 const xpBefore=document.getElementById('totalXp').textContent;
 const habitsBefore=JSON.stringify(JSON.parse(saved).habits);
 document.querySelector('#gameBottomNav [data-game-tab="shop"]').click();
 await pause();
 requireOk(document.querySelectorAll('#coinShopItems .coin-item').length===5,'market needs exactly five items');
 requireOk(document.getElementById('coinBalance').textContent==='255','initial wallet not loaded');
 requireOk(!document.getElementById('coinFreeGacha').disabled,'free draw not available');
 window.confirm=()=>true;
 document.querySelector('#coinShopItems [data-coin-item="cloak"]').click();
 await pause();
 requireOk(document.getElementById('coinBalance').textContent==='195','purchase price not deducted');
 requireOk(document.querySelector('[data-coin-item="cloak"][data-coin-action="equip"]'),'owned item not equippable');
 document.querySelector('[data-coin-item="cloak"][data-coin-action="equip"]').click();
 await pause();
 requireOk(document.getElementById('characterPortrait').dataset.gear==='cloak','purchased gear did not update character');
 requireOk(!document.getElementById('coinGearOnHome').hidden,'home gear sticker missing');
 document.getElementById('coinFreeGacha').click();
 await pause();
 requireOk(document.getElementById('coinResultDialog').open,'draw did not show reveal');
 requireOk(document.getElementById('coinResultTitle').textContent.includes('すでに'),'duplicate conversion not surfaced');
 requireOk(document.getElementById('coinBalance').textContent==='210','duplicate refund missing');
 requireOk(document.getElementById('coinFreeGacha').disabled,'second free draw was not prevented');
 requireOk(window.__coinTest.drawCount===1,'draw duplicated');
 document.getElementById('coinResultClose').click();
 requireOk(!document.getElementById('coinResultDialog').open,'draw result did not close');
 requireOk(document.getElementById('totalXp').textContent===xpBefore,'coin actions changed XP');
 requireOk(JSON.stringify(JSON.parse(localStorage.getItem('habit-quest-v1')).habits)===habitsBefore,'coin actions changed habits');
 document.body.setAttribute('data-coin-market-flow','PASS');
}catch(e){document.body.setAttribute('data-coin-market-flow','FAIL '+String(e.message).replace(/["<>]/g,''))}})();
</script>`;
test('Chrome: wallet, purchase, equip, duplicate free draw and XP isolation',{timeout:45000},async t=>{
 if(!chrome){if(process.env.CI)assert.fail('Chrome missing on CI');t.skip('No Chrome');return}
 const raw=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=raw.replace('<script src="./cloud-config.js"></script>',fakeSdk+'<script src="./cloud-config.js"></script>').replace('</body>',check+'</body>');
 const resources=new Map([['/index.html',app],
  ['/cloud-config.js','window.HABIT_QUEST_CLOUD={url:"https://test.supabase.co",anonKey:"sb_publishable_demo"};']]);
 for(const file of ['goal-metrics.js','habit-lifecycle.js','sync-guard.js','sync-merge.js','daily-adventure.js','adventure-world.js',
    'cloud-onboarding.js','game-shell.js','game-shell.css','coin-shop.js','coin-shop.css'])
   resources.set('/'+file,fs.readFileSync(path.join(root,file),'utf8'));
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!resources.has(pathname)){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':'text/javascript'});
  res.end(resources.get(pathname));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'hq-coin-ui-'));
  let stdout='',stderr='';
  try{
   const url='http://127.0.0.1:'+server.address().port+'/index.html';
   const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--disable-background-networking','--no-first-run','--user-data-dir='+profile,
    '--window-size=500,844','--virtual-time-budget=4000','--dump-dom',url],{stdio:['ignore','pipe','pipe']});
   proc.stdout.on('data',d=>stdout+=d);proc.stderr.on('data',d=>stderr+=d);
   const killer=setTimeout(()=>proc.kill('SIGKILL'),30000);
   const code=await new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('exit',resolve)});
   clearTimeout(killer);
   assert.equal(code,0,stderr.slice(-500));
   const marker=stdout.match(/data-coin-market-flow="([^"]+)"/);
   assert.ok(marker,'Coin UI test failed to initialize '+stdout.slice(-600));
   assert.equal(marker[1],'PASS','Coin shop UI failed');
  }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2})}
 }finally{server.close()}
});

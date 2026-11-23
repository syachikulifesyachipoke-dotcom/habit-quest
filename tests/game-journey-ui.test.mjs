import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executable=['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .map(name=>spawnSync('which',[name],{encoding:'utf8'}))
 .find(result=>result.status===0)?.stdout.trim();
const prelude=`<script>
(()=>{
 const date=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 const shift=(key,n)=>{const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const seven=new URLSearchParams(location.search).has('sevenDayTest');
 const count=seven?6:1,checks={};
 for(let i=1;i<=count;i++)checks[shift(date,-i)]={read:true};
 localStorage.setItem('habit-quest-v1',JSON.stringify({
  xpStartDate:shift(date,-count),
  habits:[{id:'read',name:'読書',icon:'book',target:5,ouraTrackingOnly:false}],
  checks,rewardedWeeks:[],avatarImages:{},ouraData:{},ouraTrackingVersion:3,
  ouraAutoEnabled:true,ouraAutoKeys:[],ouraSuppressedKeys:[]
 }));
})();
</script>`;
const injection=`<script>
(()=>{try{
 const verify=(x,msg)=>{if(!x)throw Error(msg)};
 const seven=new URLSearchParams(location.search).has('sevenDayTest');
 const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 const getXP=()=>Number(document.getElementById('totalXp').textContent.replace(/[^0-9]/g,''));
 const previousXP=getXP();
 const check=document.querySelector('#tracker [data-habit="read"][data-day="'+today+'"]');
 verify(check&&!check.disabled,'manual checkbox missing');
 const initialArea=document.getElementById('worldPeekName').textContent;
 check.click();
 verify(getXP()===previousXP+20,'game feature altered established XP gain');
 verify(JSON.parse(localStorage.getItem('habit-quest-v1')).checks[today].read===true,'check lost in localStorage');
 if(seven){
  verify(!document.getElementById('gameUnlockDialog').open,'no region unlock should occur on 7th day');
  verify(document.getElementById('eventProgressTitle').textContent.includes('完結'),'seven-day story not completed');
  document.querySelector('#gameBottomNav [data-game-tab="events"]').click();
  verify(!document.querySelector('[data-story-day="7"]').disabled,'chapter seven still locked');
  document.querySelector('[data-story-day="7"]').click();
  verify(document.getElementById('eventStoryText').textContent.includes('七つの足跡'),'chapter seven did not render');
 }else{
  verify(initialArea==='旅立ちの野営地','unexpected initial region');
  verify(document.getElementById('worldPeekName').textContent==='ほたるの森','area did not unlock');
  const dialog=document.getElementById('gameUnlockDialog');
  verify(dialog.open,'region arrival overlay not shown');
  verify(document.getElementById('gameUnlockTitle').textContent.includes('ほたるの森'),'arrival title mismatch');
  document.getElementById('gameUnlockAction').click();
  verify(!dialog.open,'arrival overlay cannot close');
  verify(!document.getElementById('screen-events').hidden,'arrival did not navigate to event screen');
  verify(document.getElementById('worldMapDialog').open,'arrival did not open exploration map');
  verify(document.querySelectorAll('#worldMapList .world-area.unlocked').length===2,'two regions not unlocked');
  document.getElementById('worldMapClose').click();
 }
 document.body.setAttribute('data-journey-flow','PASS');
}catch(e){document.body.setAttribute('data-journey-flow','FAIL '+String(e.message).replace(/["<>]/g,''))}})();
</script>`;
test('Chrome real interaction: region arrival overlay and final day-seven chapter',{timeout:42000},async t=>{
 if(!executable){
   if(process.env.CI)assert.fail('No headless Chrome binary available on CI');
   t.skip('No local Chrome');return;
 }
 const raw=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=raw.replace('<script src="./cloud-config.js"></script>',prelude+'<script src="./cloud-config.js"></script>')
              .replace('</body>',injection+'</body>');
 assert.notEqual(raw,app);
 const resources=new Map([['/index.html',app],['/cloud-config.js','window.HABIT_QUEST_CLOUD={url:"",anonKey:""};']]);
 for(const file of ['goal-metrics.js','habit-lifecycle.js','sync-guard.js','sync-merge.js','daily-adventure.js',
   'adventure-world.js','cloud-onboarding.js','game-shell.js','game-shell.css','coin-shop.js','coin-shop.css']){
  resources.set('/'+file,fs.readFileSync(path.join(root,file),'utf8'));
 }
 const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!resources.has(pathname)){response.writeHead(404);response.end();return}
  const type=pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':'text/javascript';
  response.writeHead(200,{'Content-Type':type+'; charset=utf-8'});response.end(resources.get(pathname));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const suffix of ['','?sevenDayTest=1']){
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'habit-g3-journey-'));
   let stdout='',stderr='';
   try{
    const url='http://127.0.0.1:'+server.address().port+'/index.html'+suffix;
    const p=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
      '--disable-background-networking','--user-data-dir='+profile,'--window-size=500,844',
      '--virtual-time-budget=2600','--dump-dom',url],{stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',data=>stdout+=data.toString());
    p.stderr.on('data',data=>stderr+=data.toString());
    const killer=setTimeout(()=>p.kill('SIGKILL'),30000);
    const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',resolve)});
    clearTimeout(killer);
    assert.equal(code,0,stderr.slice(-600));
    const marker=stdout.match(/data-journey-flow="([^"]+)"/);
    assert.ok(marker,'No completion marker '+stdout.slice(-900));
    assert.equal(marker[1],'PASS','journey flow failed: '+suffix);
   }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2})}
  }
 }finally{server.close()}
});

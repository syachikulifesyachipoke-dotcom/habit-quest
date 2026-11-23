import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const findBrowser=()=>{
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    const r=spawnSync('which',[name],{encoding:'utf8'});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
};
const prelude=`<script>
(()=>{
 const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 localStorage.setItem('habit-quest-v1',JSON.stringify({
  xpStartDate:today,
  habits:[{id:'baseline',name:'既存の習慣',icon:'book',target:7,ouraTrackingOnly:false}],
  checks:{'2026-01-01':{baseline:true}},
  rewardedWeeks:[],avatarImages:{},ouraData:{},ouraTrackingVersion:3,
  ouraAutoEnabled:true,ouraAutoKeys:[],ouraSuppressedKeys:[]
 }));
})();
</script>`;
const injection=`<script>
(()=>{try {
 const requireOk=(yes,label)=>{if(!yes)throw Error(label)};
 const state=()=>JSON.parse(localStorage.getItem('habit-quest-v1'));
 const xp=()=>document.getElementById('totalXp').textContent;
 const fireForm=()=>document.getElementById('habitForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 const name='A2ブラウザ試験 '+Date.now();
 window.confirm=()=>true;
 document.getElementById('addHabit').click();
 document.getElementById('habitName').value=name;
 document.getElementById('habitTarget').value='2';
 fireForm();
 let h=state().habits.find(x=>x.name===name);
 requireOk(!!h,'habit not saved');
 requireOk(/^\\d{4}-\\d{2}-\\d{2}$/.test(h.createdOn),'creation date missing');
 requireOk(h.ouraTrackingOnly===false&&h.missionEnabled===true,'manual category');
 const currentButton=[...document.querySelectorAll('[data-habit="'+h.id+'"][data-day]')].find(x=>!x.disabled);
 requireOk(!!currentButton,'no available check button');
 currentButton.click();
 const day=currentButton.dataset.day;
 requireOk(state().checks[day]?.[h.id]===true,'check missing');
 const xpBefore=xp();
 requireOk(Number(xpBefore.replace(/[^0-9]/g,''))===20,'XP baseline or pre-first-login exclusion failed: '+xpBefore);
 document.querySelector('[data-edit="'+h.id+'"]').click();
 document.getElementById('habitTarget').value='3';
 document.getElementById('habitWeeklyMission').checked=false;
 fireForm();
 h=state().habits.find(x=>x.id===h.id);
 requireOk(h.target===3&&h.ouraTrackingOnly===false&&h.missionEnabled===false,'edit or mission failed');
 requireOk(Array.isArray(h.targetHistory)&&h.targetHistory.length>0,'history missing');
 document.querySelector('[data-edit="'+h.id+'"]').click();
 document.getElementById('deleteHabit').click();
 h=state().habits.find(x=>x.id===h.id);
 requireOk(!!h,'habit definition was deleted');
 requireOk(h.activeIntervals.at(-1).until!==null,'habit did not archive');
 requireOk(!document.querySelector('[data-edit="'+h.id+'"]'),'archived habit remains in tracker');
 requireOk(state().checks[day]?.[h.id]===true,'archive deleted check');
 requireOk(xp()===xpBefore,'archive changed XP');
 document.querySelector('#archivedHabitList [data-restore="'+h.id+'"]').click();
 h=state().habits.find(x=>x.id===h.id);
 requireOk(h.activeIntervals.at(-1).until===null,'restore failed');
 requireOk(!!document.querySelector('[data-edit="'+h.id+'"]'),'restored habit missing from tracker');
 requireOk(state().checks[day]?.[h.id]===true,'restore deleted history');
 requireOk(xp()===xpBefore,'restore changed XP');
 document.body.setAttribute('data-browser-flow','PASS');
} catch(error){
 document.body.setAttribute('data-browser-flow','FAIL '+String(error.message).replace(/["<>]/g,''));
}})();
</script>`;

test('headless Chrome: add, check, edit, archive and restore preserve XP and history',{timeout:35000},async t=>{
 const executable=findBrowser();
 if(!executable){
   if(process.env.CI)assert.fail('No Chrome or Chromium binary found on CI');
   t.skip('No local Chrome/Chromium binary');
   return;
 }
 const raw=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=raw.replace('<script src="./cloud-config.js"></script>',prelude+'<script src="./cloud-config.js"></script>')
   .replace('</body>',injection+'</body>');
 assert.notEqual(app,raw,'browser fixture injection failed');
 const scripts=new Map([
   ['/index.html',app],
   ['/goal-metrics.js',fs.readFileSync(path.join(root,'goal-metrics.js'),'utf8')],
   ['/habit-lifecycle.js',fs.readFileSync(path.join(root,'habit-lifecycle.js'),'utf8')],
   ['/cloud-config.js','window.HABIT_QUEST_CLOUD={url:"",anonKey:""};']
 ]);
 const server=http.createServer((req,res)=>{
   const filename=new URL(req.url,'http://localhost').pathname;
   if(!scripts.has(filename)){res.writeHead(404);res.end('not found');return}
   res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});
   res.end(scripts.get(filename));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'habit-quest-a2-chrome-'));
 let stdout='',stderr='';
 try{
   const target='http://127.0.0.1:'+server.address().port+'/index.html';
   const args=['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
     '--disable-background-networking','--no-first-run','--disable-extensions',
     '--user-data-dir='+profile,'--virtual-time-budget=2000','--dump-dom',target];
   const p=spawn(executable,args,{stdio:['ignore','pipe','pipe']});
   p.stdout.on('data',data=>stdout+=data.toString());
   p.stderr.on('data',data=>stderr+=data.toString());
   const kill=setTimeout(()=>p.kill('SIGKILL'),26000);
   const code=await new Promise((resolve,reject)=>{
     p.on('error',reject);p.on('exit',resolve);
   });
   clearTimeout(kill);
   assert.equal(code,0,'headless Chrome exited unexpectedly: '+stderr.slice(-800));
   const marker=stdout.match(/data-browser-flow="([^"]+)"/);
   assert.ok(marker,'browser test did not finish: '+stdout.slice(-900)+' '+stderr.slice(-500));
   assert.equal(marker[1],'PASS','browser flow failed');
 }finally{
   server.close();
   fs.rmSync(profile,{recursive:true,force:true,maxRetries:3});
 }
});

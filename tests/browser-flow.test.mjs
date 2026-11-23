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
  rewardedWeeks:[],avatarImages:{},ouraData:{[today]:{steps:8000}},ouraTrackingVersion:3,
  ouraAutoEnabled:true,ouraAutoKeys:[],ouraSuppressedKeys:[]
 }));
})();
</script>`;
const injection=`<script>
(async()=>{try {
 const requireOk=(yes,label)=>{if(!yes)throw Error(label)};
 const state=()=>JSON.parse(localStorage.getItem('habit-quest-v1'));
 const xp=()=>document.getElementById('totalXp').textContent;
 const fireForm=()=>document.getElementById('habitForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 const tabs=['home','character','events','shop','options'];
 for(const tab of tabs){
  const button=document.querySelector('#gameBottomNav [data-game-tab="'+tab+'"]');
  requireOk(!!button,'missing nav button '+tab);
  button.click();
  requireOk(!document.getElementById('screen-'+tab).hidden,'nav did not open '+tab);
  requireOk(button.getAttribute('aria-current')==='page','nav current marker missing '+tab);
  requireOk(document.querySelectorAll('.game-screen:not([hidden])').length===1,'multiple screens visible');
 }
 requireOk(document.getElementById('settingsDetail').closest('#screen-options'),'settings were not moved into options');
 requireOk(document.querySelectorAll('.group-streak').length===3,'three group streak indicators missing');
 requireOk(document.getElementById('homeStepsValue').textContent==='8,000','home steps did not display imported Oura count');
 requireOk(document.getElementById('homeStepsStatus').dataset.state==='under','exactly 8,000 must NOT qualify');
 requireOk(document.getElementById('homeStepsSync'),'one-click Oura refresh absent');
 document.getElementById('homeStepsOpen').click();
 requireOk(!document.getElementById('stepsHistory').hidden,'history not open');
 requireOk(document.getElementById('stepsHistoryList').textContent.includes('8,000歩'),'today missing from historical steps');
 requireOk(document.getElementById('stepsHistoryList').textContent.includes('未達成'),'8,000 walking should be under threshold in history');
 document.getElementById('homeStepsOpen').click();
 requireOk(document.getElementById('weeklyBoss'),'weekly boss encounter missing');
 requireOk(document.querySelectorAll('.tracker-group-heading').length>=1,'tracker category headings missing');

 requireOk(!!document.getElementById('optionsExportBtn')&&!!document.getElementById('optionsImportBtn'),'backup shortcuts missing');
 document.getElementById('characterPat').click();
 requireOk(document.getElementById('characterReactionText').textContent.includes('ありがとう'),'companion pet reaction failed');
 requireOk(document.getElementById('characterPortrait').dataset.mood==='petted','companion portrait did not react');
 requireOk(!document.getElementById('characterMoodFace')&&!document.getElementById('homeCompanionMood'),'emoji-face stickers must not exist');
 document.querySelector('#gameBottomNav [data-game-tab="home"]').click();
 const name='A2ブラウザ試験 '+Date.now();
 window.confirm=()=>true;
 document.getElementById('addHabit').click();
 document.getElementById('habitName').value=name;
 document.getElementById('habitTarget').value='2';
 fireForm();
 let h=state().habits.find(x=>x.name===name);
 requireOk(!!h,'habit not saved');
 requireOk(document.getElementById('headerXp').textContent===document.getElementById('totalXp').textContent,'header XP initially inconsistent');
 requireOk(document.getElementById('headerCoins').textContent==='—','offline coin HUD should show unavailable state');
 requireOk(/^\\d{4}-\\d{2}-\\d{2}$/.test(h.createdOn),'creation date missing');
 requireOk(h.ouraTrackingOnly===false&&h.missionEnabled===true,'manual category');
 const bossHpBefore=Number(document.getElementById('bossHp').textContent.split('/')[0]);
 const currentButton=[...document.querySelectorAll('[data-habit="'+h.id+'"][data-day]')].find(x=>!x.disabled);
 requireOk(!!currentButton,'no available check button');
 currentButton.click();
 const day=currentButton.dataset.day;
 requireOk(state().checks[day]?.[h.id]===true,'check missing');
 requireOk(Number(document.getElementById('bossHp').textContent.split('/')[0])===bossHpBefore-20,'weekly boss damage is not aligned with checkbox');
 requireOk(document.getElementById('headerXp').textContent===document.getElementById('totalXp').textContent,'XP HUD did not update with daily check');
 requireOk(document.getElementById('journeyCount').textContent.includes('/ 7日'),'adventure map did not render');
 requireOk(document.getElementById('dailyQuestTitle').textContent.includes('達成'),'daily adventure did not celebrate a manual check');
 requireOk(document.getElementById('journeyBadgeTitle').textContent==='旅立ちの証','first adventure badge did not unlock');
 document.querySelector('#gameBottomNav [data-game-tab="events"]').click();
 requireOk(!document.querySelector('#eventChapters [data-story-day="1"]').disabled,'first chapter did not unlock');
 document.querySelector('#eventChapters [data-story-day="1"]').click();
 requireOk(document.getElementById('eventStoryText').textContent.includes('最初の一歩'),'chapter story did not render');
 document.querySelector('#gameBottomNav [data-game-tab="shop"]').click();
 requireOk(document.querySelectorAll('#shopFrames .shop-item').length===5,'free cosmetics inventory incomplete');
 requireOk(document.querySelectorAll('#shopRelics .shop-relic').length===10,'relic collection incomplete');
 document.querySelector('#gameBottomNav [data-game-tab="home"]').click();
 requireOk(document.querySelectorAll('#journeyDays .journey-day').length===7,'weekly adventure map must show seven days');
 requireOk(document.getElementById('worldPeekName').textContent==='旅立ちの野営地','world map start region missing');
 requireOk(document.getElementById('worldTodayText').textContent.includes('今日の出会い'),'today world scene did not unlock');
 document.getElementById('worldMapOpen').click();
 requireOk(document.getElementById('worldMapDialog').open,'exploration map did not open');
 requireOk(document.querySelectorAll('#worldMapList .world-area').length===10,'world should contain ten discoverable areas');
 requireOk(document.querySelectorAll('#worldMapList .world-area.unlocked').length===1,'world initial region should be unlocked');
 requireOk(document.querySelectorAll('#worldDiaryList .world-diary-entry').length===1,'manual check did not generate diary entry');
 requireOk(document.querySelector('#worldMapList .world-relic').textContent.includes('はじまりの地図'),'initial exploration relic missing');
 document.getElementById('worldMapClose').click();
 requireOk(!document.getElementById('worldMapDialog').open,'world map did not close');
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
 // Test the actual Export button and File input Import flow, not only JSON.parse.
 let exportedBlob=null;
 const oldCreate=URL.createObjectURL;
 URL.createObjectURL=function(blob){exportedBlob=blob;return oldCreate.call(URL,blob)};
 document.querySelector('#gameBottomNav [data-game-tab="options"]').click();
 document.getElementById('optionsExportBtn').click();
 document.querySelector('#gameBottomNav [data-game-tab="home"]').click();
 URL.createObjectURL=oldCreate;
 requireOk(exportedBlob instanceof Blob,'backup did not create a Blob');
 const backup=JSON.parse(await exportedBlob.text());
 const backed=backup.habits.find(x=>x.id===h.id);
 requireOk(!!backed&&backed.missionEnabled===false,'backup lost mission flag');
 requireOk(backed.targetHistory?.length>0&&backed.activeIntervals?.length>0,'backup lost lifecycle history');
 requireOk(backup.checks[day]?.[h.id]===true,'backup lost check');
 // Create a real change, then import the exported backup through the file UI.
 const checkedButton=[...document.querySelectorAll('[data-habit="'+h.id+'"][data-day]')].find(x=>x.dataset.day===day);
 requireOk(!!checkedButton&&!checkedButton.disabled,'cannot toggle backed up check');
 checkedButton.click();
 requireOk(state().checks[day]?.[h.id]!==true,'test did not create a changed check');
 requireOk(document.getElementById('journeyBadgeTitle').textContent==='冒険のはじまり','badge did not revert when the check was undone');
 requireOk(document.querySelector('#eventChapters [data-story-day="1"]').disabled,'undo must lock first chapter');
 requireOk(!document.getElementById('worldTodayText').textContent.includes('今日の出会い'),'scene did not clear after unchecked habit');
 requireOk(document.querySelectorAll('#worldDiaryList .world-diary-entry').length===0,'unchecked habit left phantom diary entry');
 const dt=new DataTransfer();
 dt.items.add(new File([JSON.stringify(backup)],'backup.json',{type:'application/json'}));
 const fileInput=document.getElementById('fileInput');
 fileInput.files=dt.files;
 fileInput.dispatchEvent(new Event('change',{bubbles:true}));
 // File.text() and the import change listener are async: wait for the actual
 // restored check, not a brittle fixed 90ms on virtual-time Chrome.
 for(let i=0;i<30&&state().checks[day]?.[h.id]!==true;i++)
  await new Promise(resolve=>setTimeout(resolve,50));
 const reimported=state().habits.find(x=>x.id===h.id);
 requireOk(state().checks[day]?.[h.id]===true,'JSON import failed to restore check');
 requireOk(reimported.targetHistory?.length>0&&reimported.activeIntervals?.length>0,'JSON import lost lifecycle');
 requireOk(xp()===xpBefore,'JSON import changed XP');
 requireOk(document.getElementById('journeyBadgeTitle').textContent==='旅立ちの証','restored check did not restore badge');
 requireOk(!document.querySelector('#eventChapters [data-story-day="1"]').disabled,'restored check did not restore chapter');
 requireOk(document.getElementById('worldTodayText').textContent.includes('今日の出会い'),'restored record did not restore encounter');
 requireOk(document.querySelectorAll('#worldDiaryList .world-diary-entry').length===1,'backup restore did not restore diary');
 if(new URLSearchParams(location.search).has('mobileTest')){
  requireOk(window.innerWidth<=580,'mobile viewport not active: '+window.innerWidth);
  requireOk(!document.getElementById('headerCoins').hidden,'mobile coin HUD not visible');
  const header=document.querySelector('header.header').getBoundingClientRect();
  const last=document.getElementById('headerCoins').closest('.resource-pill').getBoundingClientRect();
  requireOk(last.right<=header.right+2,'resource HUD overflows header on narrow screen');
  requireOk(last.left>=header.left-2,'resource HUD is not inside header');
  requireOk(getComputedStyle(document.querySelector('main>.intro')).order==='0','mobile RPG card not first');
  requireOk(getComputedStyle(document.querySelector('main>.content')).order==='1','mobile tracker not second');
  requireOk(document.querySelectorAll('.habit-row').length>0,'mobile habit rows not rendered');
  requireOk([...document.querySelectorAll('.habit-row')].some(r=>r.querySelector('[data-day]')),'mobile touch check grid missing');
 }
 document.body.setAttribute('data-browser-flow','PASS');
} catch(error){
 document.body.setAttribute('data-browser-flow','FAIL '+String(error.message).replace(/["<>]/g,''));
}})();
</script>`;

test('headless Chrome: lifecycle and JSON backup/import preserve checks and XP',{timeout:35000},async t=>{
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
   ['/sync-guard.js',fs.readFileSync(path.join(root,'sync-guard.js'),'utf8')],
   ['/sync-merge.js',fs.readFileSync(path.join(root,'sync-merge.js'),'utf8')],
   ['/daily-adventure.js',fs.readFileSync(path.join(root,'daily-adventure.js'),'utf8')],
   ['/adventure-world.js',fs.readFileSync(path.join(root,'adventure-world.js'),'utf8')],
   ['/cloud-onboarding.js',fs.readFileSync(path.join(root,'cloud-onboarding.js'),'utf8')],
   ['/game-shell.js',fs.readFileSync(path.join(root,'game-shell.js'),'utf8')],
   ['/coin-shop.js',fs.readFileSync(path.join(root,'coin-shop.js'),'utf8')],
   ['/coin-shop.css',fs.readFileSync(path.join(root,'coin-shop.css'),'utf8')],
   ['/resource-hud.css',fs.readFileSync(path.join(root,'resource-hud.css'),'utf8')],
   ['/habit-groups.js',fs.readFileSync(path.join(root,'habit-groups.js'),'utf8')],
   ['/weekly-boss.js',fs.readFileSync(path.join(root,'weekly-boss.js'),'utf8')],
   ['/oura-steps.js',fs.readFileSync(path.join(root,'oura-steps.js'),'utf8')],
   ['/reminder-calendar.js',fs.readFileSync(path.join(root,'reminder-calendar.js'),'utf8')],
   ['/g6-gameplay.css',fs.readFileSync(path.join(root,'g6-gameplay.css'),'utf8')],
   ['/game-shell.css',fs.readFileSync(path.join(root,'game-shell.css'),'utf8')],
   ['/cloud-config.js','window.HABIT_QUEST_CLOUD={url:"",anonKey:""};']
 ]);
 const server=http.createServer((req,res)=>{
   const filename=new URL(req.url,'http://localhost').pathname;
   if(!scripts.has(filename)){res.writeHead(404);res.end('not found');return}
   res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});
   res.end(scripts.get(filename));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const scenarios=[{name:'desktop',size:'1280,800',suffix:''},{name:'mobile',size:'500,844',suffix:'?mobileTest=1'}];
 try{
 for(const scenario of scenarios){
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'habit-quest-a3-'+scenario.name+'-'));
   let stdout='',stderr='';
   try{
     const target='http://127.0.0.1:'+server.address().port+'/index.html'+scenario.suffix;
     const args=['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
       '--disable-background-networking','--no-first-run','--disable-extensions',
       '--window-size='+scenario.size,'--user-data-dir='+profile,
       '--virtual-time-budget=6500','--dump-dom',target];
     const p=spawn(executable,args,{stdio:['ignore','pipe','pipe']});
     p.stdout.on('data',d=>stdout+=d.toString());
     p.stderr.on('data',d=>stderr+=d.toString());
     const kill=setTimeout(()=>p.kill('SIGKILL'),28000);
     const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',resolve)});
     clearTimeout(kill);
     assert.equal(code,0,scenario.name+' Chrome failed: '+stderr.slice(-700));
     const marker=stdout.match(/data-browser-flow="([^"]+)"/);
     assert.ok(marker,scenario.name+' browser did not complete: '+stdout.slice(-800));
     assert.equal(marker[1],'PASS',scenario.name+' browser flow failed');
   }finally{
     fs.rmSync(profile,{recursive:true,force:true,maxRetries:3});
   }
 }
 }finally{server.close();}
});

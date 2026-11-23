import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.split('<script>')[1].split('</script>')[0];
const start=source.indexOf('async function saveCloud(force){');
const end=source.indexOf("$('cloudUseRemote').onclick",start);
assert.ok(start!==-1&&end>start,'cloud save handler anchors');
const saveSource=source.slice(start,end);
const pollStart=source.indexOf('async function cloudPollLatest(){');
const pollEnd=source.indexOf("$('cloudRefresh').onclick",pollStart);
assert.ok(pollStart!==-1&&pollEnd>pollStart,'cloud polling handler anchors');
const pollSource=source.slice(pollStart,pollEnd);
const sg={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sync-guard.js'),'utf8'),sg);
const guard=sg.window.HabitQuestSyncGuard.losses;
const modern={
 xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',createdOn:'2026-11-23',target:3,missionEnabled:true,ouraTrackingOnly:false,
 targetHistory:[{effectiveOn:'2026-11-23',target:3,mission:true}],
 activeIntervals:[{from:'2026-11-23',until:null}]}],checks:{},rewardedWeeks:[]
};
const legacy={
 xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',target:3,ouraTrackingOnly:false}],checks:{},rewardedWeeks:[]
};
const clone=x=>JSON.parse(JSON.stringify(x));
const make=(local,remote,behavior)=>{
 let rpcCalls=0, fetchCalls=0, choiceCalls=0;
 const messages=[];
 const cloud={
  client:{rpc:async(name,params)=>{rpcCalls++;return behavior?.rpc?behavior.rpc(name,params):
   {data:[{new_revision:11,is_conflict:false}],error:null}}},
  user:{id:'test'},saving:false,ready:true,blocked:false,seq:1,syncedSeq:0,revision:10,
  remote:{data:clone(remote),revision:10}
 };
 const ctx={
  cloud,state:clone(local),window:{},document:{visibilityState:'visible'},
  cloudSnapshot:s=>clone({...s,habitSchemaVersion:2}),
  missingLifecycleFrom:(before,after)=>guard(before,after),
  choiceVisible:()=>choiceCalls++,
  cloudMessage:text=>messages.push(text),
  cloudFetch:async()=>{fetchCalls++;return behavior?.fetch?behavior.fetch():{data:clone(remote),revision:11}},
  scheduleCloudSave:()=>{},
  render:()=>{},offset:0,
  validateIncoming:s=>clone(s),
  validXpStartDate:s=>s,
  isoToday:()=> '2026-11-23',
  localStorage:{setItem:()=>{}},
  KEY:'habit-quest-v1',
  setTimeout:()=>{}
 };
 vm.runInNewContext(saveSource+'\n'+pollSource,ctx);
 return {ctx,cloud,messages,get rpcCalls(){return rpcCalls},get fetchCalls(){return fetchCalls},get choiceCalls(){return choiceCalls}};
};

test('cloud save rejects locally downgraded payload before any RPC call',async()=>{
 const c=make(legacy,modern);
 await c.ctx.saveCloud(true);
 assert.equal(c.rpcCalls,0);
 assert.equal(c.cloud.blocked,true);
 assert.equal(c.cloud.ready,false);
 assert.ok(c.messages.some(s=>s.includes('失われます')));
});

test('cloud save accepts a lifecycle-preserving snapshot and tracks revision',async()=>{
 const c=make(modern,modern);
 await c.ctx.saveCloud(true);
 assert.equal(c.rpcCalls,1);
 assert.equal(c.cloud.revision,11);
 assert.equal(c.cloud.remote.revision,11);
 assert.equal(c.cloud.syncedSeq,1);
 assert.equal(c.cloud.blocked,false);
});

test('cloud save detects revision conflict and stops overwrite',async()=>{
 const c=make(modern,modern,{rpc:async()=>({data:[{new_revision:null,is_conflict:true}],error:null})});
 await c.ctx.saveCloud(true);
 assert.equal(c.rpcCalls,1);
 assert.equal(c.fetchCalls,1);
 assert.equal(c.cloud.blocked,true);
 assert.equal(c.cloud.ready,false);
 assert.ok(c.choiceCalls>0);
});

test('remote downgrade blocks auto-poll before local data or XP is replaced',async()=>{
 const c=make(modern,modern,{fetch:()=>({revision:12,data:legacy})});
 c.cloud.seq=0;c.cloud.syncedSeq=0;
 await c.ctx.cloudPollLatest();
 assert.equal(c.fetchCalls,1);
 assert.equal(c.cloud.blocked,true);
 assert.equal(c.cloud.ready,false);
 assert.equal(c.ctx.state.habits[0].activeIntervals.length,1);
 assert.equal(c.ctx.state.xpStartDate,'2026-11-23');
 assert.ok(c.messages.some(s=>s.includes('欠落')));
});

test('remote with preserved lifecycle metadata can be applied by cloud poll',async()=>{
 const remote=clone(modern);
 remote.habits[0].target=5;
 remote.habits[0].targetHistory.push({effectiveOn:'2026-11-24',target:5,mission:true});
 const c=make(modern,remote,{fetch:()=>({revision:12,data:remote})});
 c.cloud.seq=0;c.cloud.syncedSeq=0;
 await c.ctx.cloudPollLatest();
 assert.equal(c.cloud.blocked,false);
 assert.equal(c.cloud.revision,12);
 assert.equal(c.ctx.state.habits[0].target,5);
 assert.equal(c.ctx.state.habits[0].targetHistory.length,2);
});

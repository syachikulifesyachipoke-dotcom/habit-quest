import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
const inline=app.split('<script>')[1].split('</script>')[0];
const a=inline.indexOf('async function attachCloudUser(user){');
const b=inline.indexOf('async function initCloud()',a);
assert.ok(a>=0&&b>a,'real login handler must exist');
const actual=inline.slice(a,b);
const window={};
vm.runInNewContext(fs.readFileSync(path.join(root,'cloud-onboarding.js'),'utf8'),{window});
const {canAdopt}=window.HabitQuestCloudOnboard;
const defaults=[
 {id:'read',name:'読書',icon:'book',target:5},
 {id:'oura_cycling',name:'自転車',icon:'bike',target:2,ouraTrackingOnly:true}
];
const clone=x=>JSON.parse(JSON.stringify(x));
const remote={habitSchemaVersion:2,xpStartDate:'2026-11-23',habits:[{id:'read',name:'読書',icon:'book',target:4,createdOn:'2026-11-23',
  targetHistory:[{effectiveOn:'2026-11-23',target:4,mission:true}],activeIntervals:[{from:'2026-11-23',until:null}]}],
  checks:{'2026-11-23':{read:true}},rewardedWeeks:[],ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:[]};
function fixture({raw=null,owner=null,baseline=null,local=null,remoteData=remote}={}){
 const entries=new Map();
 if(raw!==null)entries.set('habit-quest-v1',raw);
 if(owner)entries.set('habit-quest-v1-xp-owner',owner);
 const $=(id)=>({hidden:false,value:'',classList:{toggle(){}},setAttribute(){}});
 const cloud={client:{},user:null,revision:null,remote:null,ready:false,blocked:true,seq:0,syncedSeq:0,loadPromise:null};
 const shown=[],messages=[],renders=[];
 const state=local||{habits:clone(defaults),checks:{},rewardedWeeks:[],xpStartDate:null};
 const env={
  cloud,state,window,KEY:'habit-quest-v1',defaultHabits:clone(defaults),$, 
  localStorage:{getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>entries.set(k,v)},
  restoreCloudBase:()=>baseline?{data:clone(baseline),revision:10}:null,
  cloudFetch:async()=>({data:clone(remoteData),revision:11}),
  missingLifecycleFrom:()=>[],
  validateIncoming:clone,
  validXpStartDate:d=>d||null,isoToday:()=> '2026-11-23',
  cloudSnapshot:x=>clone(x),stableStringify:x=>JSON.stringify(x),
  rememberCloudBase:(x,rev)=>{cloud.baseSnapshot=clone(x);cloud.baseRevision=rev},
  choiceVisible:(visible)=>shown.push(visible),cloudMessage:m=>messages.push(m),
  render:()=>renders.push(clone(env.state)),scheduleCloudSave:()=>{},
  checkOuraConnection:()=>{},markFirstLoginDate:()=>{},setTimeout:()=>{},
  gameWalletAction:async()=>null
 };
 vm.runInNewContext(actual,env);
 return {env,cloud,shown,messages,renders,entries,login:()=>env.attachCloudUser({id:'userA',email:'test@example.invalid'})};
}
test('pristine phone without local saved state safely adopts cloud after login',async()=>{
 const f=fixture();
 await f.login();
 assert.equal(f.cloud.ready,true);
 assert.equal(f.cloud.blocked,false);
 assert.equal(f.cloud.revision,11);
 assert.equal(f.env.state.habits[0].target,4);
 assert.equal(f.env.state.checks['2026-11-23'].read,true);
 assert.equal(f.entries.get('habit-quest-v1-xp-owner'),'userA');
 assert.equal(f.shown.at(-1),false);
 assert.ok(f.messages.some(v=>v.includes('自動反映')));
});
test('a modified phone keeps its own habit settings instead of silent cloud replacement',async()=>{
 const changed={habits:[{...defaults[0],target:7},defaults[1]],checks:{},rewardedWeeks:[]};
 const f=fixture({raw:JSON.stringify(changed),local:clone(changed)});
 await f.login();
 assert.equal(f.cloud.ready,false);
 assert.equal(f.env.state.habits[0].target,7);
 assert.equal(f.shown.at(-1),true);
});
test('a phone with unsynced checks cannot be treated as pristine',async()=>{
 const changed={habits:defaults,checks:{'2026-11-22':{read:true}},rewardedWeeks:[]};
 const f=fixture({raw:JSON.stringify(changed),local:clone(changed)});
 await f.login();
 assert.equal(f.cloud.ready,false);
 assert.deepEqual(f.env.state.checks,changed.checks);
 assert.equal(f.shown.at(-1),true);
});
test('cross-account device never silently adopts other account cloud',async()=>{
 const f=fixture({owner:'another-user'});
 await f.login();
 assert.equal(f.cloud.ready,false);
 assert.equal(f.shown.at(-1),true);
});
test('matching known baseline permits fetching changed server habit goal',async()=>{
 const base=clone(remote);
 const next=clone(remote);next.habits[0].target=3;
 const f=fixture({raw:JSON.stringify(base),owner:'userA',local:clone(base),baseline:base,remoteData:next});
 await f.login();
 assert.equal(f.cloud.ready,true);
 assert.equal(f.env.state.habits[0].target,3);
 assert.equal(f.shown.at(-1),false);
});
test('pristine classifier does not classify manual edits, Oura entries or malformed JSON as clean',()=>{
 assert.equal(canAdopt(null,defaults,'A',null),true);
 assert.equal(canAdopt(null,defaults,'A','B'),false);
 assert.equal(canAdopt('{invalid',defaults,'A',null),false);
 assert.equal(canAdopt(JSON.stringify({habits:defaults,checks:{},rewardedWeeks:[]}),defaults,'A',null),true);
 const edited=clone(defaults);edited[0].name='別の名前';
 assert.equal(canAdopt(JSON.stringify({habits:edited,checks:{}}),defaults,'A',null),false);
 assert.equal(canAdopt(JSON.stringify({habits:defaults,checks:{},ouraAutoKeys:['2026-11-23|oura_cycling']}),defaults,'A',null),false);
});

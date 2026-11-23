import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=source.indexOf('function reconcileOuraHabits(daily,workouts){');
const end=source.indexOf('async function renderOuraCandidates(daily){',start);
assert.ok(start>=0&&end>start,'Oura reconciliation source must be directly tested');
const realCode=source.slice(start,end);
const w={};
vm.runInNewContext(fs.readFileSync(path.join(root,'oura-steps.js'),'utf8'),{window:w});
function setup(){
 const state={
  habits:[{id:'oura_walking',name:'ウォーキング',target:7,activeIntervals:[]}],
  checks:{},ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:[]
 };
 let stores=0,renders=0;
 const window={
  HabitQuestOuraSteps:w.HabitQuestOuraSteps,
  HabitQuestLifecycle:{activeOn:()=>true,create:h=>h}
 };
 const context={
  window,state,ouraSyncStats:null,
  cloud:{client:{},user:{id:'test'},ready:true,blocked:false},
  ouraWakeDay:()=>null,ouraWorkoutHabit:w=>({day:w.day,id:'oura_walking',name:'ウォーキング'}),
  safeOuraAutoKeys:a=>Array.isArray(a)?a:[],HIDDEN_OURA_HABITS:new Set(),
  OURA_ACTIVITY_HABITS:{walking:{id:'oura_walking',name:'ウォーキング',target:7}},
  isoToday:()=> '2026-11-23',
  awardCompletedOuraWeeks:()=>false,store:()=>{stores++},render:()=>{renders++},toast:()=>{}
 };
 vm.runInNewContext(realCode,context);
 return {context,state,getCounts:()=>({stores,renders})};
}
test('10 minute walking workout cannot check walking when Oura steps are only 8000',()=>{
 const t=setup();
 const d=[{day:'2026-11-23',steps:8000}];
 const w=[{day:'2026-11-23',activity:'walking'}];
 const r=t.context.reconcileOuraHabits(d,w);
 assert.equal(r.added,0);
 assert.equal(t.state.checks['2026-11-23']?.oura_walking,undefined);
 assert.deepEqual(Array.from(r.records,x=>x.id),[]);
 assert.equal(t.getCounts().stores,0);
});
test('8001 daily steps automatically checks walking once, even without walking workout',()=>{
 const t=setup();
 const d=[{day:'2026-11-23',steps:8001}];
 const once=t.context.reconcileOuraHabits(d,[]);
 assert.equal(once.added,1);
 assert.equal(t.state.checks['2026-11-23'].oura_walking,true);
 assert.deepEqual(Array.from(t.state.ouraAutoKeys),['2026-11-23|oura_walking']);
 assert.equal(t.getCounts().stores,1);
 const twice=t.context.reconcileOuraHabits(d,[{day:'2026-11-23'}]);
 assert.equal(twice.added,0);
 assert.equal(t.getCounts().stores,1);
});
test('historical walking workout checks remain available, historical step totals do not retro-award checks',()=>{
 const t=setup();
 const r=t.context.reconcileOuraHabits([
  {day:'2026-11-22',steps:15500},{day:'2026-11-23',steps:1000}
 ],[]);
 assert.equal(r.added,0);
 assert.equal(Object.keys(t.state.checks).length,0);
 const legacy=t.context.reconcileOuraHabits([],[{day:'2026-11-22'}]);
 assert.equal(legacy.added,1);
 assert.equal(t.state.checks['2026-11-22'].oura_walking,true);
});
test('pre-existing walking record and manual suppression are not deleted or overridden',()=>{
 const t=setup();
 t.state.checks['2026-11-23']={oura_walking:true};
 t.state.ouraSuppressedKeys.push('2026-11-23|oura_walking');
 const r=t.context.reconcileOuraHabits([{day:'2026-11-23',steps:8001}],[]);
 assert.equal(r.added,0);
 assert.equal(t.state.checks['2026-11-23'].oura_walking,true);
 assert.deepEqual(Array.from(t.state.ouraSuppressedKeys),['2026-11-23|oura_walking']);
});

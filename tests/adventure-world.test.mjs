import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const box={window:{}};
for(const name of ['habit-lifecycle.js','daily-adventure.js','adventure-world.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),box);
const life=box.window.HabitQuestLifecycle;
const daily=box.window.HabitQuestDailyAdventure;
const world=box.window.HabitQuestWorld;
const daysAfter=(start,n)=>{
 const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);
 return d.toISOString().slice(0,10);
};
const start='2026-11-23';
function make(n,opts={}){
 const habit=life.create({id:'reading',name:'読書',target:5,ouraTrackingOnly:false,missionEnabled:true},start);
 const checks={};
 for(let i=0;i<n;i++)checks[daysAfter(start,i)]={reading:true};
 const today=opts.today||daysAfter(start,Math.max(0,n-1));
 return daily.describe({
  habits:opts.habits||[habit],checks:opts.checks||checks,today,
  xpStartDate:opts.xpStart===undefined?start:opts.xpStart,
  activeOn:life.activeOn,archived:life.archived,configOn:life.configOn
 });
}
test('first login has a world, but no extra XP, item grants or fictional diary',()=>{
 const d=make(0),r=world.describe(d);
 assert.equal(r.days,0);
 assert.equal(r.current.id,'camp');
 assert.equal(r.discovered,1);
 assert.equal(r.todayReady,false);
 assert.equal(r.diary.length,0);
 assert.equal(r.untilNext,2);
 assert.equal(r.progress,0);
});
test('one manual-check day creates a deterministic scene and diary page',()=>{
 const d=make(1),r=world.describe(d);
 assert.equal(r.days,1);
 assert.equal(r.todayReady,true);
 assert.equal(r.todayScene.dayNumber,1);
 assert.equal(r.diary[0].date,start);
 assert.equal(r.todayScene.text,world.encounterFor(start,0));
 assert.equal(r.current.id,'camp');
 assert.equal(r.progress,50);
});
test('regions unlock exactly on their milestone days',()=>{
 const thresholds=[[0,'camp'],[2,'forest'],[5,'hill'],[10,'library'],[20,'valley'],[40,'port'],
  [70,'peak'],[120,'ruins'],[200,'observatory'],[365,'sky']];
 for(const [required,id] of thresholds){
  const r=world.describe({activeDays:required,activityDates:[],today:start,todayDone:0});
  assert.equal(r.current.id,id,'threshold '+required);
  assert.equal(r.discovered,thresholds.indexOf(thresholds.find(x=>x[0]===required))+1);
 }
 assert.equal(world.describe({activeDays:364}).current.id,'observatory');
 assert.equal(world.describe({activeDays:365}).next,null);
 assert.equal(world.describe({activeDays:500}).progress,100);
});
test('next destination is previewed but later regions remain locked',()=>{
 const r=world.describe({activeDays:2});
 assert.equal(r.current.id,'forest');
 assert.equal(r.next.id,'hill');
 assert.equal(r.untilNext,3);
 assert.equal(r.unlocked.filter(x=>x.unlocked).length,2);
 assert.equal(r.unlocked.filter(x=>x.next).length,1);
 assert.equal(r.unlocked.filter(x=>x.next)[0].id,'hill');
});
test('multiple manual checks on the same day advance exploration only once',()=>{
 const h1=life.create({id:'reading',name:'読書',target:5,ouraTrackingOnly:false,missionEnabled:true},start);
 const h2=life.create({id:'study',name:'勉強',target:5,ouraTrackingOnly:false,missionEnabled:true},start);
 const d=daily.describe({habits:[h1,h2],checks:{[start]:{reading:true,study:true}},today:start,
  xpStartDate:start,activeOn:life.activeOn,archived:life.archived,configOn:life.configOn});
 const r=world.describe(d);
 assert.equal(d.todayDone,2);
 assert.equal(d.activeDays,1);
 assert.equal(r.days,1);
 assert.equal(r.diary.length,1);
});
test('future checks and pre-first-login checks cannot manufacture new area progress',()=>{
 const h=life.create({id:'reading',name:'読書',target:5,ouraTrackingOnly:false,missionEnabled:true},start);
 const checks={'2026-11-20':{reading:true},'2026-11-23':{reading:true},'2026-11-30':{reading:true}};
 const d=daily.describe({habits:[h],checks,today:start,xpStartDate:start,
  activeOn:life.activeOn,archived:life.archived,configOn:life.configOn});
 const r=world.describe(d);
 assert.equal(r.days,1);
 assert.equal(r.diary.length,1);
 assert.equal(r.todayScene.date,start);
});
test('Oura-only exercise does not unlock the manual adventure',()=>{
 const h=life.create({id:'oura_cycling',name:'サイクリング',target:3,ouraTrackingOnly:true},start);
 const d=daily.describe({habits:[h],checks:{[start]:{oura_cycling:true}},today:start,xpStartDate:start,
  activeOn:life.activeOn,archived:life.archived,configOn:life.configOn});
 assert.equal(world.describe(d).days,0);
 assert.equal(world.describe(d).todayReady,false);
});
test('archived habits do not generate false footsteps in their rest interval',()=>{
 const h=life.archive(life.create({id:'reading',name:'読書',target:5,ouraTrackingOnly:false},start),'2026-11-24');
 const d=daily.describe({habits:[h],checks:{
  '2026-11-23':{reading:true},'2026-11-25':{reading:true}
 },today:'2026-11-25',xpStartDate:start,
  activeOn:life.activeOn,archived:life.archived,configOn:life.configOn});
 const r=world.describe(d);
 assert.equal(r.days,1);
 assert.equal(r.todayReady,false);
 assert.equal(r.diary.length,1);
});
test('missed calendar days do not erase relics or discoveries',()=>{
 const d=make(2,{today:'2026-12-12'});
 const r=world.describe(d);
 assert.equal(r.current.id,'forest');
 assert.equal(r.discovered,2);
 assert.equal(r.todayReady,false);
 assert.equal(r.diary.length,2);
});
test('the five-page journal remembers which region was current on each day',()=>{
 const d=make(11);
 const r=world.describe(d);
 assert.equal(r.diary.length,5);
 assert.equal(r.diary[0].dayNumber,11);
 assert.equal(r.diary[0].regionId,'library');
 assert.equal(r.diary[1].regionId,'library');
 assert.equal(r.diary.at(-1).dayNumber,7);
 assert.equal(r.diary.at(-1).regionId,'hill');
});
test('the daily encounter text is stable across repeated visits and devices',()=>{
 const a=world.encounterFor('2026-11-23',0);
 assert.equal(a,world.encounterFor('2026-11-23',0));
 assert.ok(typeof a==='string'&&a.length>5);
 assert.equal(world.REGIONS.length,10);
 assert.equal(new Set(Array.from(world.REGIONS,x=>x.id)).size,10);
});
test('no XP start yields no historical world progress, but never deletes checks',()=>{
 const d=make(2,{xpStart:null});
 const r=world.describe(d);
 assert.equal(r.days,0);
 assert.equal(r.diary.length,0);
});
test('game derivation does not mutate existing state or award XP',()=>{
 const current=make(5),before=JSON.stringify(current);
 world.describe(current);
 assert.equal(JSON.stringify(current),before);
});

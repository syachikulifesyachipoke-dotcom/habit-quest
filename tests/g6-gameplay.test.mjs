import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={window:{}};
for(const file of ['habit-groups.js','weekly-boss.js','oura-steps.js','reminder-calendar.js']){
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
}
const groups=ctx.window.HabitQuestGroups,boss=ctx.window.HabitQuestWeeklyBoss,
 steps=ctx.window.HabitQuestOuraSteps,reminder=ctx.window.HabitQuestReminder;
test('three stable and exhaustive core group assignments match requested ordering',()=>{
 const h=[
  {id:'study',name:'勉強'},{id:'read',name:'読書'},{id:'journal',name:'ジャーナル'},
  {id:'randomBio',name:'ﾋﾞｵﾌｪﾙﾐﾝ'},{id:'randomNo',name:'No酒'},{id:'wake',name:'早起'},
  {id:'oura_strengthtraining',name:'筋トレ'},{id:'oura_cycling',name:'サイクリング'},
  {id:'oura_walking',name:'ウォーキング'},{id:'oura_running',name:'ランニング'}];
 const g=groups.groupHabits(h);
 assert.deepEqual(Array.from(g.investment,x=>x.name),['勉強','読書','ジャーナル']);
 assert.deepEqual(Array.from(g.wellbeing,x=>x.name),['ﾋﾞｵﾌｪﾙﾐﾝ','No酒','早起']);
 assert.deepEqual(Array.from(g.exercise,x=>x.name),['筋トレ','サイクリング','ウォーキング','ランニング']);
 assert.equal(g.other.length,0);
});
test('custom categories persist while established known IDs cannot be accidentally moved',()=>{
 assert.equal(groups.groupFor({id:'custom',name:'新しい習慣',groupId:'exercise'}),'exercise');
 assert.equal(groups.groupFor({id:'custom',name:'読書',groupId:'wellbeing'}),'wellbeing');
 assert.equal(groups.groupFor({id:'study',name:'勉強',groupId:'exercise'}),'investment');
 assert.equal(groups.groupFor({id:'unknown',name:'知らない習慣'}),'other');
});
test('one valid check per each group per day means three independent streaks',()=>{
 const h=[{id:'study'},{id:'read'},{id:'wake'},{id:'oura_walking'}];
 const checks={
 '2026-11-20':{study:true,wake:true,oura_walking:true},
 '2026-11-21':{read:true,wake:true},
 '2026-11-22':{study:true,oura_walking:true},
 '2026-11-23':{study:true,wake:true}
 };
 const data=groups.streak({habits:h,checks,today:'2026-11-23',start:'2026-11-20',activeOn:()=>true});
 assert.equal(data.investment.days,4);
 assert.equal(data.wellbeing.days,1);
 assert.equal(data.exercise.days,0); // today and yesterday have no exercise check
});
test('today uncompleted uses yesterday as grace day for each group only',()=>{
 const data=groups.streak({habits:[{id:'study'}],checks:{
  '2026-11-21':{study:true},'2026-11-22':{study:true}},today:'2026-11-23',
 start:'2026-11-21',activeOn:()=>true});
 assert.equal(data.investment.days,2);
 assert.equal(data.investment.todayDone,false);
 assert.equal(data.wellbeing.days,0);
});
test('pre-login checks and dates outside active intervals never inflate group streaks',()=>{
 const data=groups.streak({habits:[{id:'study'}],
 checks:{'2026-11-20':{study:true},'2026-11-21':{study:true},'2026-11-22':{study:true},'2026-11-23':{study:true}},
 today:'2026-11-23',start:'2026-11-22',activeOn:(_,day)=>day!=='2026-11-22'});
 assert.equal(data.investment.days,1);
});
test('weekly boss shares the weekly chest completed count and never awards extra resources',()=>{
 const first=boss.describe('2026-11-23',{done:0,target:10,complete:false});
 assert.equal(first.totalHp,200);assert.equal(first.hp,200);assert.equal(first.state,'waiting');
 const mid=boss.describe('2026-11-23',{done:6,target:10});
 assert.equal(mid.hp,80);assert.equal(mid.damage,120);
 const win=boss.describe('2026-11-23',{done:10,target:10,complete:true});
 assert.equal(win.hp,0);assert.equal(win.state,'defeated');assert.equal(win.isDefeated,true);
 assert.equal(boss.describe('2026-11-23',{done:100,target:10}).hp,0);
 assert.equal(boss.describe('2026-11-23',{done:0,target:0}).state,'no-mission');
 assert.doesNotMatch(fs.readFileSync(path.join(root,'weekly-boss.js'),'utf8'),/localStorage|fetch\(|\.rpc\(|XP_CHECK|coins=/);
});
test('same week boss is deterministic across browser and week rollover',()=>{
 assert.deepEqual(boss.describe('2026-11-23',{done:2,target:3}),boss.describe('2026-11-23',{done:2,target:3}));
 assert.equal(boss.BOSSES.length,4);
 assert.ok(boss.describe('2026-11-23',{done:2,target:3}).name);
});
test('walking strict boundary: 8,000 no, 8,001 yes, missing is unknown',()=>{
 assert.equal(steps.qualified(8000),false);
 assert.equal(steps.qualified(8001),true);
 assert.equal(steps.qualified(0),false);
 assert.equal(steps.qualified(null),false);
 assert.equal(steps.qualified(undefined),false);
 assert.equal(steps.status(null),'unknown');
 assert.equal(steps.status(8000),'under');
 assert.equal(steps.status(8001),'achieved');
 assert.equal(steps.numberOfSteps(-1),null);
 assert.equal(steps.numberOfSteps(8001.5),null);
});
test('step records before rollout may be inspected but cannot create retro XP checks',()=>{
 const rows=[
  {day:'2026-11-22',steps:12500},
  {day:'2026-11-23',steps:8000},
  {day:'2026-11-24',steps:8001},
  {day:'2026-11-25',steps:null}
 ];
 assert.deepEqual(Array.from(steps.qualifiedRecords(rows,'2026-11-25'),x=>x.day),['2026-11-24']);
 const all=steps.allHistory(Object.fromEntries(rows.map(x=>[x.day,{steps:x.steps}])),'2026-11-25');
 assert.equal(all.length,4);
 assert.equal(all.at(-1).qualified,true);
 assert.equal(all[0].status,'unknown');
});
test('user can download free daily 05:40 JST reminder but browser cannot force app launch',()=>{
 const date=Date.parse('2026-11-23T20:39:59Z');
 assert.equal(reminder.nextJapanDate('05:40',date),'20261124');
 assert.equal(reminder.nextJapanDate('05:40',Date.parse('2026-11-23T20:40:00Z')),'20261125');
 const ics=reminder.calendarFile('05:40',date);
 assert.match(ics,/DTSTART;TZID=Asia\/Tokyo:20261124T054000/);
 assert.match(ics,/RRULE:FREQ=DAILY/);
 assert.match(ics,/BEGIN:VALARM/);
 assert.match(ics,/TRIGGER:PT0M/);
 assert.match(ics,/URL:https:\/\/syachikulifesyachipoke-dotcom\.github\.io\/habit-quest\//);
 assert.equal(reminder.validTime('25:40'),false);
 assert.throws(()=>reminder.calendarFile('25:40',date));
});

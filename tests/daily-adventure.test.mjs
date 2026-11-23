import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const win={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'daily-adventure.js'),'utf8'),win);
const {describe,BADGES}=win.window.HabitQuestDailyAdventure;
vm.runInNewContext(fs.readFileSync(path.join(root,'habit-lifecycle.js'),'utf8'),win);
const lifecycle=win.window.HabitQuestLifecycle;
const today='2026-11-23';
const habit=(id='read',target=5)=>lifecycle.create({
 id,name:id==='read'?'読書':'学習',target,ouraTrackingOnly:false,missionEnabled:true
},today);
const base=()=>({
 today,xpStartDate:today,habits:[habit('read')],
 checks:{},activeOn:lifecycle.activeOn,archived:lifecycle.archived,configOn:lifecycle.configOn
});
test('new player sees a single suggested manual quest and seven day nodes',()=>{
 const r=describe(base());
 assert.equal(r.focus?.id,'read');
 assert.equal(r.todayDone,0);
 assert.equal(r.dayNodes.length,7);
 assert.equal(r.dayNodes[0].label,'月');
 assert.equal(r.dayNodes[0].today,true);
 assert.equal(r.weekDone,0);
 assert.equal(r.activeDays,0);
 assert.equal(r.nextBadge.days,1);
});
test('one manual checkbox clears daily first step and unlocks first badge',()=>{
 const s=base();s.checks[today]={read:true};
 const r=describe(s);
 assert.equal(r.todayDone,1);
 assert.equal(r.allTodayDone,true);
 assert.equal(r.weekDone,1);
 assert.equal(r.activeDays,1);
 assert.equal(r.badge.name,'旅立ちの証');
 assert.equal(r.focus,null);
});
test('Oura and wake do not create manual footsteps or quest recommendations',()=>{
 const s=base();
 s.habits.push({id:'wake',name:'起床',target:7,ouraTrackingOnly:true});
 s.habits.push({id:'oura_cycling',name:'自転車',target:2,ouraTrackingOnly:true});
 s.checks[today]={wake:true,oura_cycling:true};
 const r=describe(s);
 assert.equal(r.todayDone,0);
 assert.equal(r.weekDone,0);
 assert.equal(r.activeDays,0);
 assert.equal(r.focus?.id,'read');
});
test('past checks before initial login date never award adventure history',()=>{
 const s=base();
 s.checks={'2026-11-22':{read:true},'2026-11-23':{read:true}};
 const r=describe(s);
 assert.equal(r.activeDays,1);
 assert.equal(r.weekDone,1);
});
test('no manual habit returns an optional setup state rather than a false failure',()=>{
 const s=base();s.habits=[];s.checks[today]={oura_running:true};
 const r=describe(s);
 assert.equal(r.hasManualHabits,false);
 assert.equal(r.todayDone,0);
 assert.equal(r.badge,null);
});
test('badge progression counts distinct days rather than a punitive streak',()=>{
 const s=base();s.today='2026-12-07';
 s.checks={
  '2026-11-23':{read:true},
  '2026-11-26':{read:true},
  '2026-12-07':{read:true}
 };
 const r=describe(s);
 assert.equal(r.activeDays,3);
 assert.equal(r.badge.days,3);
 assert.equal(r.nextBadge.days,7);
 assert.equal(r.weekDone,1);
});
test('archived habit keeps valid past footsteps while not creating present-day quest',()=>{
 const h=habit();
 const paused=lifecycle.archive(h,'2026-11-24');
 const s=base();s.habits=[paused];s.today='2026-11-26';
 s.checks={'2026-11-23':{read:true},'2026-11-25':{read:true}};
 const r=describe(s);
 assert.equal(r.activeDays,1);
 assert.equal(r.todayDone,0);
 assert.equal(r.focus,null);
});
test('future check records do not count as adventure or current badge progress',()=>{
 const s=base();s.checks={'2026-11-25':{read:true}};
 const r=describe(s);
 assert.equal(r.activeDays,0);
 assert.equal(r.weekDone,0);
 assert.equal(r.dayNodes[2].future,true);
 assert.equal(r.dayNodes[2].done,false);
});
test('missed days never remove the earned badge or the adventure total',()=>{
 const s=base();s.today='2026-12-06';
 s.checks={'2026-11-23':{read:true}};
 const r=describe(s);
 assert.equal(r.activeDays,1);
 assert.equal(r.badge.days,1);
 assert.equal(r.weekDone,0);
});
test('daily focus prioritizes an incomplete mission without forcing extra tasks',()=>{
 const s=base();s.habits.push(habit('study',1));
 const r=describe(s);
 assert.equal(r.focus.id,'read');
 s.checks[today]={read:true};
 const next=describe(s);
 assert.equal(next.focus.id,'study');
 assert.equal(next.todayDone,1);
});
test('read-only adventure calculator never mutates checks, habits or XP base',()=>{
 const s=base(),before=JSON.stringify({habits:s.habits,checks:s.checks,xpStartDate:s.xpStartDate});
 describe(s);
 assert.equal(JSON.stringify({habits:s.habits,checks:s.checks,xpStartDate:s.xpStartDate}),before);
 assert.equal(BADGES[0].days,1);
 assert.equal(BADGES.at(-1).days,365);
});
test('invalid dates fail safely with no trial XP or changes',()=>{
 const s=base();s.today='2026-02-31';s.checks['2026-02-31']={read:true};
 const r=describe(s);
 assert.equal(r.today,null);
 assert.equal(r.activeDays,0);
 assert.equal(r.dayNodes.length,0);
});

test('before account first-login start, existing historical checks do not unlock badges',()=>{
 const s=base();s.xpStartDate=null;s.checks[today]={read:true};
 const r=describe(s);
 assert.equal(r.activeDays,0);
 assert.equal(r.badge,null);
 assert.equal(r.weekDone,0);
 assert.equal(r.todayDone,1); // visible daily action is still counted normally
});

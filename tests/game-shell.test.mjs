import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'game-shell.js'),'utf8'),sandbox);
const {describe,TABS,CHAPTERS,FRAMES}=sandbox.window.HabitQuestGameShell;
const day=n=>({activeDays:n,hasManualHabits:true,manualToday:1,todayDone:n>0?1:0});
const region={current:{name:'ほたるの森'}};
test('all five bottom navigation tabs exist in required order',()=>{
 assert.deepEqual(Array.from(TABS),['home','character','events','shop','options']);
});
test('the story has seven unique chapters keyed to independent manual-activity days',()=>{
 assert.equal(CHAPTERS.length,7);
 assert.deepEqual(Array.from(CHAPTERS,c=>c.day),[1,2,3,4,5,6,7]);
 assert.equal(new Set(Array.from(CHAPTERS,c=>c.title)).size,7);
});
test('before a manual check, chapter one is locked without inventing rewards',()=>{
 const r=describe(day(0),region,1);
 assert.equal(r.completedChapters,0);
 assert.equal(r.activeChapter,null);
 assert.equal(r.nextChapter.day,1);
 assert.equal(r.chapterProgress,0);
 assert.equal(r.mood,'ready');
});
test('one manual-activity day reveals chapter one and a happy companion',()=>{
 const r=describe(day(1),region,2);
 assert.equal(r.completedChapters,1);
 assert.equal(r.activeChapter.day,1);
 assert.equal(r.nextChapter.day,2);
 assert.equal(r.chapterProgress,14);
 assert.equal(r.mood,'celebrate');
 assert.equal(r.worldName,'ほたるの森');
});
test('all seven chapters unlock after seven distinct days, not streak penalties',()=>{
 const r=describe(day(7),region,9);
 assert.equal(r.completedChapters,7);
 assert.equal(r.nextChapter,null);
 assert.equal(r.activeChapter.day,7);
 assert.equal(r.allSevenComplete,true);
 assert.equal(r.chapterProgress,100);
});
test('progress remains complete after 365 days, with no artificial caps on days',()=>{
 const r=describe(day(365),region,50);
 assert.equal(r.activeDays,365);
 assert.equal(r.completedChapters,7);
 assert.equal(r.level,50);
});
test('not recording today does not revoke earlier unlocked chapters',()=>{
 const r=describe({...day(5),todayDone:0},region,6);
 assert.equal(r.completedChapters,5);
 assert.equal(r.mood,'ready');
});
test('the companion rests rather than shaming a user with all habits paused',()=>{
 const r=describe({activeDays:3,hasManualHabits:true,manualToday:0,todayDone:0},region,3);
 assert.equal(r.mood,'rest');
 assert.match(r.reaction,/休憩/);
 assert.equal(r.completedChapters,3);
});
test('a user with no manual habits is invited to start, not punished',()=>{
 const r=describe({activeDays:0,hasManualHabits:false,manualToday:0,todayDone:0},region,1);
 assert.equal(r.mood,'rest');
 assert.match(r.reaction,/習慣/);
});
test('the shop has five purely cosmetic free frames with explicit thresholds',()=>{
 assert.equal(FRAMES.length,5);
 assert.deepEqual(Array.from(FRAMES,f=>f.days),[0,2,7,30,100]);
 assert.equal(describe(day(0),region,1).unlockedFrames.length,1);
 assert.equal(describe(day(2),region,1).unlockedFrames.length,2);
 assert.equal(describe(day(7),region,1).unlockedFrames.length,3);
 assert.equal(describe(day(100),region,1).unlockedFrames.length,5);
});
test('progress is derived read-only from existing checks, without XP mutations',()=>{
 const d=day(3),before=JSON.stringify(d);
 describe(d,region,3);
 assert.equal(JSON.stringify(d),before);
 const source=fs.readFileSync(path.join(root,'game-shell.js'),'utf8');
 assert.doesNotMatch(source, /localStorage|fetch\(|\.rpc\(|XP_CHECK|XP_WEEK/);
});
test('malformed progress numbers do not unlock unearned chapters',()=>{
 const r=describe({activeDays:NaN,todayDone:0,manualToday:0,hasManualHabits:true},null,NaN);
 assert.equal(r.activeDays,0);
 assert.equal(r.level,1);
 assert.equal(r.completedChapters,0);
});

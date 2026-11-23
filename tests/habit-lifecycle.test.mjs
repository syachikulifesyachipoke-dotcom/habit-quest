import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.split('<script>')[1].split('</script>')[0];
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'habit-lifecycle.js'),'utf8'),sandbox);
const L=sandbox.window.HabitQuestLifecycle;
const week=(monday)=>Array.from({length:7},(_,i)=>{
 const d=new Date(monday+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);
});

test('existing habits without lifecycle fields keep historical eligibility',()=>{
 const h=L.normalize({id:'legacy',name:'読書',target:5,ouraTrackingOnly:false});
 assert.equal(h.createdOn,null);
 assert.equal(L.activeOn(h,'2024-02-01'),true);
 assert.equal(L.archived(h),false);
 assert.equal(L.configOn(h,'2026-11-22').target,5);
});

test('new habit starts exactly on creation day and is never an obligation before that',()=>{
 const h=L.create({id:'new',name:'読書',target:7,ouraTrackingOnly:false},'2026-11-26');
 assert.equal(L.activeOn(h,'2026-11-25'),false);
 assert.equal(L.activeOn(h,'2026-11-26'),true);
 assert.equal(h.targetHistory[0].effectiveOn,'2026-11-26');
 assert.equal(L.weekProgress(h,week('2026-11-23'),()=>true,'2026-11-23').target,4);
});

test('archives pause future observations without deleting the definition or historical days',()=>{
 const h=L.create({id:'habit-id',name:'勉強',target:5,ouraTrackingOnly:false},'2026-11-20');
 const a=L.archive(h,'2026-11-21');
 assert.equal(a.id,h.id);
 assert.equal(L.archived(a),true);
 assert.equal(L.activeOn(a,'2026-11-20'),true);
 assert.equal(L.activeOn(a,'2026-11-21'),false);
 const restored=L.restore(a,'2026-11-23');
 assert.equal(restored.id,h.id);
 assert.equal(L.archived(restored),false);
 assert.equal(L.activeOn(restored,'2026-11-22'),false);
 assert.equal(L.activeOn(restored,'2026-11-23'),true);
 assert.equal(restored.activeIntervals.length,2);
});

test('same-day completion survives archive and same-day restore',()=>{
 const h=L.create({id:'trained',target:3,ouraTrackingOnly:true},'2026-11-22');
 const archived=L.archive(h,'2026-11-23',true);
 assert.equal(L.activeOn(archived,'2026-11-23'),true);
 assert.equal(L.activeOn(archived,'2026-11-24'),false);
 const restored=L.restore(archived,'2026-11-23');
 assert.equal(L.archived(restored),false);
 assert.equal(L.activeOn(restored,'2026-11-23'),true);
});

test('editing a target preserves prior effective-day target',()=>{
 const original=L.normalize({id:'read',target:3,ouraTrackingOnly:false});
 const edited=L.edit(original,'2026-11-23',5,true);
 assert.equal(L.configOn(edited,'2026-11-22').target,3);
 assert.equal(L.configOn(edited,'2026-11-23').target,5);
 assert.equal(edited.targetHistory.length,2);
});

test('mission toggle changes future days only, including Oura automatic item',()=>{
 const original=L.normalize({id:'oura_cycling',target:2,ouraTrackingOnly:true});
 const edited=L.edit(original,'2026-11-23',2,true);
 assert.equal(L.configOn(edited,'2026-11-22').mission,false);
 assert.equal(L.configOn(edited,'2026-11-23').mission,true);
 assert.equal(edited.ouraTrackingOnly,true); // auto record source never changes
 assert.equal(edited.missionEnabled,true);
 const again=L.edit(edited,'2026-11-23',3,false);
 assert.equal(again.missionEnabled,false);
 assert.equal(again.targetHistory.length,2);
 assert.equal(L.configOn(again,'2026-11-22').mission,false);
 assert.equal(L.configOn(again,'2026-11-23').target,3);
 assert.equal(L.configOn(again,'2026-11-23').mission,false);
});

test('week mission uses the historical target for a completed week',()=>{
 const original=L.normalize({id:'read',target:3,ouraTrackingOnly:false});
 const edited=L.edit(original,'2026-11-23',5,true);
 const days=week('2026-11-16');
 let calls=0;
 const r=L.weekProgress(edited,days,(day)=>{calls++;return ['2026-11-16','2026-11-17','2026-11-18'].includes(day);});
 assert.equal(r.target,3);
 assert.equal(r.done,3);
 assert.equal(r.complete,true);
 assert.equal(calls,7);
});

test('archived Oura habit refuses records on paused days',()=>{
 const h=L.create({id:'oura_running',target:1,ouraTrackingOnly:true},'2026-11-20');
 const a=L.archive(h,'2026-11-23');
 assert.equal(L.activeOn(a,'2026-11-22'),true);
 assert.equal(L.activeOn(a,'2026-11-23'),false);
 const r=L.restore(a,'2026-11-25');
 assert.equal(L.activeOn(r,'2026-11-24'),false);
 assert.equal(L.activeOn(r,'2026-11-25'),true);
});

test('new fields survive cloud normalization and archive controls exist',()=>{
 assert.match(source,/targetHistory:h\.targetHistory,activeIntervals:h\.activeIntervals/);
 assert.match(source,/habits:s\.habits/);
 assert.match(source,/HabitQuestLifecycle\.normalize/);
 assert.match(source,/HabitQuestLifecycle\.archive\(h,today,preserveToday\)/);
 assert.match(source,/HabitQuestLifecycle\.restore\(h,isoToday\(\)\)/);
 assert.match(source,/HabitQuestLifecycle\.activeOn\(activeIds\.get\(record\.id\),record\.day\)/);
 assert.match(html,/id="archiveSection"/);
 assert.match(html,/id="archivedHabitList"/);
});

test('archive does not remove checks or award data and backend schema is unchanged',()=>{
 const block=source.match(/\$\('deleteHabit'\)\.onclick=\(\)=>\{[\s\S]*?\n\};/);
 assert.ok(block,'archive click handler exists');
 assert.doesNotMatch(block[0],/state\.habits=state\.habits\.filter|delete state\.checks|ouraIgnoredTypes/);
});

test('manual habit can opt out of mission without being reclassified as Oura',()=>{
 const manual=L.create({id:'manual-run',name:'自分でランニング',target:2,ouraTrackingOnly:false,missionEnabled:true},'2026-11-23');
 const turnedOff=L.edit(manual,'2026-11-24',2,false);
 assert.equal(turnedOff.ouraTrackingOnly,false);
 assert.equal(turnedOff.missionEnabled,false);
 assert.equal(L.configOn(turnedOff,'2026-11-23').mission,true);
 assert.equal(L.configOn(turnedOff,'2026-11-24').mission,false);
 const restored=JSON.parse(JSON.stringify(turnedOff));
 assert.equal(L.normalize(restored).missionEnabled,false);
});
test('Oura habit opt-in to weekly mission does not change its origin',()=>{
 const h=L.create({id:'oura_strengthtraining',target:3,ouraTrackingOnly:true,missionEnabled:false},'2026-11-23');
 const edited=L.edit(h,'2026-11-24',4,true);
 assert.equal(edited.ouraTrackingOnly,true);
 assert.equal(edited.missionEnabled,true);
 assert.equal(L.configOn(edited,'2026-11-23').mission,false);
 assert.equal(L.configOn(edited,'2026-11-24').mission,true);
 assert.match(source,/missionEnabled:typeof h\.missionEnabled==='boolean'/);
});

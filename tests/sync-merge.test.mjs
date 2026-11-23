import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sync-merge.js'),'utf8'),ctx);
const merge=ctx.window.HabitQuestSyncMerge.mergeCheckOnly;
const clone=o=>JSON.parse(JSON.stringify(o));
const base={
 habitSchemaVersion:2,xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',target:3,ouraTrackingOnly:false,missionEnabled:true,
 createdOn:'2026-11-23',targetHistory:[{effectiveOn:'2026-11-23',target:3,mission:true}],
 activeIntervals:[{from:'2026-11-23',until:null}]}],
 checks:{'2026-11-23':{read:true}},rewardedWeeks:[],
 avatarImages:{},ouraData:{},ouraAutoEnabled:true,ouraTrackingVersion:3,ouraAutoKeys:[],
 ouraSuppressedKeys:[],ouraIgnoredTypes:['oura_pilates','oura_dance']
};
test('independent checkbox changes merge without deleting either device history',()=>{
 const pc=clone(base),phone=clone(base);
 pc.checks['2026-11-24']={read:true};
 phone.checks['2026-11-25']={read:true};
 const result=merge(base,pc,phone);
 assert.equal(result.ok,true,result.reason);
 assert.deepEqual(Object.keys(result.state.checks).sort(),['2026-11-23','2026-11-24','2026-11-25']);
 assert.equal(result.state.checks['2026-11-24'].read,true);
 assert.equal(result.state.checks['2026-11-25'].read,true);
 assert.equal(result.state.xpStartDate,base.xpStartDate);
});

test('independent checkbox unchecks and unrelated checks are both preserved',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 pc.checks={}; // user explicitly unchecked read for first day on PC
 phone.checks['2026-11-24']={read:true};
 const result=merge(original,pc,phone);
 assert.equal(result.ok,true,result.reason);
 assert.equal(result.state.checks['2026-11-23'],undefined);
 assert.equal(result.state.checks['2026-11-24'].read,true);
});

test('both devices checking same empty cell is idempotent',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 pc.checks['2026-11-24']={read:true};phone.checks['2026-11-24']={read:true};
 const result=merge(original,pc,phone);
 assert.equal(result.ok,true,result.reason);
 assert.equal(Object.keys(result.state.checks).length,2);
});

test('mission reward keys are unioned, never removed',()=>{
 const old=clone(base),pc=clone(base),phone=clone(base);
 pc.rewardedWeeks=['2026-11-23'];
 phone.rewardedWeeks=['2026-11-30'];
 const result=merge(old,pc,phone);
 assert.equal(result.ok,true,result.reason);
 assert.deepEqual(Array.from(result.state.rewardedWeeks),['2026-11-23','2026-11-30']);
});

test('target changes are not auto merged',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 pc.habits[0].target=5;pc.habits[0].targetHistory.push({effectiveOn:'2026-11-30',target:5,mission:true});
 phone.checks['2026-11-24']={read:true};
 const result=merge(original,pc,phone);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'non-check-changes');
});

test('archived habits are never silently changed',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 phone.habits[0].activeIntervals[0].until='2026-11-25';
 const result=merge(original,pc,phone);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'non-check-changes');
});

test('first-login date change is never silently merged',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 phone.xpStartDate='2026-11-24';
 const result=merge(original,pc,phone);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'non-check-changes');
});

test('other cloud fields such as Oura auto provenance may not be overwritten',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 pc.ouraAutoKeys=['2026-11-24|oura_cycling'];
 const result=merge(original,pc,phone);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'non-check-changes');
});

test('no common saved baseline never guesses a merge',()=>{
 const result=merge(null,base,base);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'no-baseline');
});

test('reward revocations are never silently undone',()=>{
 const old=clone(base),pc=clone(base),phone=clone(base);
 old.rewardedWeeks=['2026-11-23'];
 phone.rewardedWeeks=[];pc.rewardedWeeks=['2026-11-23'];
 const result=merge(old,pc,phone);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'reward-removal');
});

test('pure merge never mutates its three inputs',()=>{
 const original=clone(base),pc=clone(base),phone=clone(base);
 pc.checks['2026-11-24']={read:true};phone.checks['2026-11-25']={read:true};
 const snapshot=JSON.stringify([original,pc,phone]);
 const result=merge(original,pc,phone);
 assert.equal(result.ok,true);
 assert.equal(JSON.stringify([original,pc,phone]),snapshot);
});

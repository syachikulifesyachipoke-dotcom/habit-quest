import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sync-guard.js'),'utf8'),sandbox);
const {losses}=sandbox.window.HabitQuestSyncGuard;
const initial={habits:[{
  id:'read',name:'読書',createdOn:'2026-11-23',missionEnabled:true,
  target:3,ouraTrackingOnly:false,targetHistory:[{effectiveOn:'2026-11-23',target:3,mission:true}],
  activeIntervals:[{from:'2026-11-23',until:null}]
}]};
const clone=data=>JSON.parse(JSON.stringify(data));

test('unchanged v2 lifecycle data is safe',()=>{
 assert.equal(losses(initial,clone(initial)).length,0);
});

test('old client loses all metadata on full-state overwrite: block it',()=>{
 const legacy={habits:[{id:'read',name:'読書',target:3,ouraTrackingOnly:false}]};
 assert.deepEqual(Array.from(losses(initial,legacy)),['read']);
});

test('old client drops an archived habit entirely: block it',()=>{
 assert.deepEqual(Array.from(losses(initial,{habits:[]})),['read']);
});

test('a current client may append historical goals and active intervals',()=>{
 const next=clone(initial);
 next.habits[0].targetHistory.push({effectiveOn:'2026-12-01',target:5,mission:true});
 next.habits[0].activeIntervals[0].until='2026-11-25';
 next.habits[0].activeIntervals.push({from:'2026-11-29',until:null});
 assert.equal(losses(initial,next).length,0);
});

test('current client refuses a remote snapshot missing a prior target-history entry',()=>{
 const next=clone(initial);
 next.habits[0].targetHistory=[];
 assert.deepEqual(Array.from(losses(initial,next)),['read']);
});

test('current client refuses a remote snapshot missing creation date or mission metadata',()=>{
 const next=clone(initial);
 delete next.habits[0].createdOn;
 assert.deepEqual(Array.from(losses(initial,next)),['read']);
 next.habits[0].createdOn='2026-11-23';
 delete next.habits[0].missionEnabled;
 assert.deepEqual(Array.from(losses(initial,next)),['read']);
});

test('legacy records without lifecycle data are not flagged',()=>{
 const previous={habits:[{id:'legacy',target:5,ouraTrackingOnly:false}]};
 assert.equal(losses(previous,{habits:[]}).length,0);
});

test('current client rejects overwritten rest interval but permits archival state updates',()=>{
 const old=clone(initial);
 old.habits[0].activeIntervals[0].until='2026-12-01';
 const newValid=clone(old);
 newValid.habits[0].activeIntervals.push({from:'2026-12-07',until:null});
 assert.equal(losses(old,newValid).length,0);
 const bad=clone(old);
 bad.habits[0].activeIntervals=[];
 assert.deepEqual(Array.from(losses(old,bad)),['read']);
});

test('guard checks current client save/fetch/login/conflict paths',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const statement of [
   'missingLifecycleFrom(state,cloud.remote.data)',
   'missingLifecycleFrom(cloud.remote.data,snapshot)',
   'missingLifecycleFrom(state,latest.data)',
   'missingLifecycleFrom(cloud.remote.data,cloudSnapshot(state))'
 ])assert.ok(html.includes(statement),statement);
});

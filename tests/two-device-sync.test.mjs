import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.split('<script>')[1].split('</script>')[0];
const extract=(a,b)=>{
 const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Missing '+a+' / '+b);
 return source.slice(start,end);
};
const actualMerge=extract('function reconcileIndependentChecks(latest){','function choiceVisible(');
const actualSave=extract('async function saveCloud(force){',"$('cloudUseRemote').onclick");
const actualPoll=extract('async function cloudPollLatest(){',"$('cloudRefresh').onclick");
const makeWindow=()=>{
 const obj={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sync-merge.js'),'utf8'),obj);
 vm.runInNewContext(fs.readFileSync(path.join(root,'sync-guard.js'),'utf8'),obj);
 return obj.window;
};
const window=makeWindow();
const clone=o=>JSON.parse(JSON.stringify(o));
const canonical=x=>clone({...x,habitSchemaVersion:2,avatarImages:{},ouraData:{}});
const original=canonical({
 xpStartDate:'2026-11-23',
 habits:[{id:'read',name:'読書',icon:'book',target:3,ouraTrackingOnly:false,missionEnabled:true,
 createdOn:'2026-11-23',targetHistory:[{effectiveOn:'2026-11-23',target:3,mission:true}],
 activeIntervals:[{from:'2026-11-23',until:null}]}],
 checks:{},rewardedWeeks:[],ouraAutoEnabled:true,ouraTrackingVersion:3,
 ouraAutoKeys:[],ouraSuppressedKeys:[],ouraIgnoredTypes:['oura_pilates','oura_dance']
});
function lab(){
 const server={data:clone(original),revision:1,networkDown:false};
 function device(label){
   const notes=[],writes={},renders=[],scheduled=[];
   const cloud={user:{id:label},client:{rpc:async(name,{p_data,p_expected_revision})=>{
      if(server.networkDown)throw Error('Network unavailable');
      if(p_expected_revision!==server.revision)return {data:[{is_conflict:true,new_revision:null}],error:null};
      server.data=clone(p_data);server.revision++;
      return {data:[{is_conflict:false,new_revision:server.revision}],error:null};
     }},remote:{data:clone(original),revision:1},
     revision:1,baseSnapshot:clone(original),baseRevision:1,seq:0,syncedSeq:0,
     saving:false,ready:true,blocked:false,polling:false};
   const context={
     window,cloud,state:clone(original),document:{visibilityState:'visible'},offset:0,KEY:'habit-quest-v1',
     cloudSnapshot:canonical,
     validateIncoming:clone,
     missingLifecycleFrom:(a,b)=>window.HabitQuestSyncGuard.losses(a,b),
     cloudFetch:async()=>{if(server.networkDown)throw Error('Network unavailable');return {data:clone(server.data),revision:server.revision}},
     choiceVisible:(show)=>notes.push('dialog:'+show),
     render:()=>renders.push(clone(context.state.checks)),
     scheduleCloudSave:()=>scheduled.push(true),
     cloudMessage:text=>notes.push(text),
     rememberCloudBase:(data,rev)=>{cloud.baseSnapshot=canonical(data);cloud.baseRevision=Number(rev)},
     localStorage:{setItem:(key,value)=>writes[key]=value},
     validXpStartDate:x=>x,
     isoToday:()=> '2026-11-23',
     checkOuraConnection:()=>{},
     setTimeout:()=>{},
   };
   vm.runInNewContext(actualMerge+'\n'+actualSave+'\n'+actualPoll,context);
   return {cloud,context,notes,writes,renders,scheduled,
     check(day,id='read'){context.state.checks[day]={...(context.state.checks[day]||{}),[id]:true};cloud.seq++},
     async send(){return context.saveCloud(true)},
     async poll(){return context.cloudPollLatest()}
   };
 }
 return {server,device};
}
test('two independent devices sync two different check dates without deleting history',async()=>{
 const l=lab(),pc=l.device('pc'),phone=l.device('phone');
 pc.check('2026-11-23');
 await pc.send();
 assert.equal(l.server.revision,2);
 phone.check('2026-11-24');
 await phone.send(); // revision conflict; safe three-way merge
 assert.equal(phone.cloud.blocked,false);
 assert.equal(phone.scheduled.length,1);
 await phone.send(); // retry with server revision
 assert.equal(l.server.revision,3);
 assert.equal(l.server.data.checks['2026-11-23'].read,true);
 assert.equal(l.server.data.checks['2026-11-24'].read,true);
 await pc.poll();
 assert.equal(pc.context.state.checks['2026-11-24'].read,true);
 assert.equal(pc.cloud.revision,3);
 assert.equal(pc.context.state.xpStartDate,original.xpStartDate);
});

test('offline check stays locally and syncs on reconnect without losing the other device check',async()=>{
 const l=lab(),pc=l.device('pc'),phone=l.device('phone');
 l.server.networkDown=true;
 pc.check('2026-11-23');
 await pc.send();
 assert.equal(l.server.revision,1);
 assert.equal(pc.context.state.checks['2026-11-23'].read,true);
 assert.notEqual(pc.cloud.seq,pc.cloud.syncedSeq);
 l.server.networkDown=false;
 phone.check('2026-11-24');
 await phone.send();
 await pc.poll(); // online/visible recovery path retries pending save, auto-merging on conflict
 assert.equal(pc.cloud.blocked,false);
 await pc.send();
 assert.equal(l.server.revision,3);
 assert.equal(l.server.data.checks['2026-11-23'].read,true);
 assert.equal(l.server.data.checks['2026-11-24'].read,true);
});

test('metadata and habit goal conflicts require user choice instead of silent merge',async()=>{
 const l=lab(),pc=l.device('pc'),phone=l.device('phone');
 pc.context.state.habits[0].target=5;
 pc.context.state.habits[0].targetHistory.push({effectiveOn:'2026-11-24',target:5,mission:true});
 pc.cloud.seq++;
 await pc.send();
 phone.check('2026-11-24');
 await phone.send();
 assert.equal(phone.cloud.blocked,true);
 assert.equal(phone.cloud.ready,false);
 assert.equal(phone.context.state.checks['2026-11-24'].read,true);
 assert.equal(l.server.data.habits[0].target,5);
 assert.equal(l.server.data.checks['2026-11-24'],undefined);
 assert.ok(phone.notes.some(n=>n.includes('競合')));
});

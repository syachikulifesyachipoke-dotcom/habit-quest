/* HABIT QUEST Phase A-2: pure, backward-compatible habit lifecycle helpers.
   All records stay inside the existing habit_states JSONB; no SQL migration. */
(function(root){
 'use strict';
 const dayValid = v => {
   if(typeof v!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;
   const d=new Date(v+'T12:00:00Z');
   return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
 };
 const weekTargetValid = t => Number.isInteger(Number(t))&&Number(t)>=1&&Number(t)<=7;
 const validStart = v => v===null||dayValid(v);
 const dayBefore = (a,b) => a===null || (b!==null && a<b);
 function normalize(h){
   const createdOn=dayValid(h.createdOn)?h.createdOn:null;
   const hist=Array.isArray(h.targetHistory)?h.targetHistory.filter(x=>x&&
     (x.effectiveOn===null||dayValid(x.effectiveOn))&&weekTargetValid(x.target)&&typeof x.mission==='boolean'
   ).map(x=>({effectiveOn:x.effectiveOn,target:Number(x.target),mission:x.mission})):[];
   hist.sort((a,b)=>a.effectiveOn===b.effectiveOn?0:a.effectiveOn===null?-1:b.effectiveOn===null?1:a.effectiveOn.localeCompare(b.effectiveOn));
   const targetHistory=[];
   for(const x of hist){
     if(targetHistory.length&&targetHistory[targetHistory.length-1].effectiveOn===x.effectiveOn)targetHistory[targetHistory.length-1]=x;
     else targetHistory.push(x);
   }
   const raw=Array.isArray(h.activeIntervals)?h.activeIntervals:[];
   const activeIntervals=[];
   for(const x of raw){
     if(!x||!validStart(x.from)||!validStart(x.until)||x.until===null&&x.from===null&&!dayValid(createdOn)) {
       if(x&&x.from===null&&x.until!==null&&dayValid(x.until)){} else continue;
     }
     if(x.until!==null && x.from!==null && x.from>x.until)continue;
     activeIntervals.push({from:x.from??null,until:x.until??null});
   }
   activeIntervals.sort((a,b)=>a.from===b.from?0:dayBefore(a.from,b.from)?-1:1);
   // If input intervals are malformed/overlapping, ignore them rather than truncating history.
   const validIntervals=activeIntervals.every((x,i)=>i===0||activeIntervals[i-1].until!==null&&
     (x.from===null||activeIntervals[i-1].until<=x.from));
   return {...h,createdOn,targetHistory,activeIntervals:validIntervals?activeIntervals:[]};
 }
 function archived(h) {
   const a=h?.activeIntervals;
   return Array.isArray(a)&&a.length>0&&a[a.length-1].until!==null;
 }
 function activeOn(h,key){
   if(!dayValid(key))return false;
   const intervals=h?.activeIntervals;
   if(Array.isArray(intervals)&&intervals.length)return intervals.some(x=>
     (x.from===null||key>=x.from)&&(x.until===null||key<x.until));
   return !dayValid(h?.createdOn)||key>=h.createdOn;
 }
 function configOn(h,key){
   let config={target:Number(h.target),mission:!h.ouraTrackingOnly};
   const history=h.targetHistory||[];
   for(const x of history)if(x.effectiveOn===null||x.effectiveOn<=key)
     config={target:Number(x.target),mission:x.mission};
   return config;
 }
 function create(h,date){
   if(!dayValid(date))throw Error('Invalid habit creation date');
   return normalize({...h,createdOn:date,activeIntervals:[{from:date,until:null}],
     targetHistory:[{effectiveOn:date,target:Number(h.target),mission:!h.ouraTrackingOnly}]});
 }
 function edit(h,date,target,mission){
   if(!dayValid(date)||!weekTargetValid(target)||typeof mission!=='boolean')throw Error('Invalid habit change');
   const old=normalize(h);
   if(Number(old.target)===Number(target)&&!old.ouraTrackingOnly===mission)return old;
   const hist=[...old.targetHistory];
   if(!hist.length)hist.push({effectiveOn:old.createdOn,target:Number(old.target),mission:!old.ouraTrackingOnly});
   if(hist.length&&hist[hist.length-1].effectiveOn===date)
     hist[hist.length-1]={effectiveOn:date,target:Number(target),mission};
   else hist.push({effectiveOn:date,target:Number(target),mission});
   return normalize({...old,target:Number(target),ouraTrackingOnly:!mission,targetHistory:hist});
 }
 function archive(h,date){
   if(!dayValid(date))throw Error('Invalid archive date');
   const old=normalize(h);
   if(archived(old))return old;
   const intervals=old.activeIntervals.length?old.activeIntervals.map(x=>({...x})):
     [{from:old.createdOn,until:null}];
   const last=intervals[intervals.length-1];
   if(last.from!==null && date<last.from)throw Error('Archive date before start');
   last.until=date; // Exclusive: a paused habit is not required starting today.
   return normalize({...old,activeIntervals:intervals});
 }
 function restore(h,date){
   if(!dayValid(date))throw Error('Invalid restore date');
   const old=normalize(h);
   if(!archived(old))return old;
   const intervals=old.activeIntervals.map(x=>({...x}));
   const last=intervals[intervals.length-1];
   if(date<last.until)throw Error('Restore date before archive date');
   // A pause/resume on the same date has no inactive calendar days.
   if(last.from===date&&last.until===date){last.until=null;}
   else intervals.push({from:date,until:null});
   return normalize({...old,activeIntervals:intervals});
 }
 function weekProgress(h,days,checks,xpStart=null){
   const relevant=days.filter(d=>(!xpStart||d>=xpStart)&&activeOn(h,d))
     .map(d=>({day:d,...configOn(h,d)})).filter(x=>x.mission);
   if(!relevant.length)return {done:0,target:0,complete:false};
   const allSameTarget=relevant.every(x=>x.target===relevant[0].target);
   const target=allSameTarget?
     Math.min(relevant[0].target,relevant.length):
     Math.min(relevant.length,Math.ceil(relevant.reduce((sum,x)=>sum+x.target,0)/7));
   const done=relevant.filter(x=>!!checks(x.day,h.id)).length;
   return {done:Math.min(done,target),target,complete:done>=target};
 }
 root.HabitQuestLifecycle=Object.freeze({
   normalize,activeOn,archived,configOn,create,edit,archive,restore,weekProgress
 });
})(typeof window==='undefined'?globalThis:window);

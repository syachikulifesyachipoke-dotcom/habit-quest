/* HABIT QUEST Phase A-3: strict, non-destructive three-way merge.
 * Automatically combines checkbox changes ONLY when all habit metadata and
 * other cloud fields are unchanged on both clients.
 * Never merges renamed, archived, edited, or newly created habits implicitly. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const stable=x=>{
   if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
   if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
   return JSON.stringify(x);
 };
 function remaining(s){
   const o={...s};
   delete o.checks;
   delete o.rewardedWeeks;
   return stable(o);
 }
 const asDays=x=>(x&&typeof x==='object'&&!Array.isArray(x))?x:{};
 const asWeeks=x=>Array.isArray(x)&&x.every(k=>typeof k==='string')?x:null;
 function mergeCheckOnly(base,local,remote){
   if(!base||!local||!remote)return {ok:false,reason:'no-baseline'};
   if(!Array.isArray(base.habits)||!Array.isArray(local.habits)||!Array.isArray(remote.habits))
     return {ok:false,reason:'invalid-habits'};
   if(remaining(base)!==remaining(local)||remaining(base)!==remaining(remote))
     return {ok:false,reason:'non-check-changes'};
   const weeks=[asWeeks(base.rewardedWeeks),asWeeks(local.rewardedWeeks),asWeeks(remote.rewardedWeeks)];
   if(weeks.some(x=>x===null))return {ok:false,reason:'invalid-weeks'};
   const baselineWeeks=new Set(weeks[0]);
   if(weeks.slice(1).some(x=>[...baselineWeeks].some(key=>!x.includes(key))))
     return {ok:false,reason:'reward-removal'};
   const out=clone(remote);
   const days=new Set([...Object.keys(asDays(base.checks)),...Object.keys(asDays(local.checks)),...Object.keys(asDays(remote.checks))]);
   const mergedChecks={};
   for(const day of days){
     const b=asDays(base.checks[day]),l=asDays(local.checks[day]),r=asDays(remote.checks[day]);
     const ids=new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)]);
     const mergedDay={};
     for(const id of ids){
       const old=b[id]===true,left=l[id]===true,right=r[id]===true;
       const leftChanged=left!==old,rightChanged=right!==old;
       if(leftChanged&&rightChanged&&left!==right)
         return {ok:false,reason:'same-cell-conflict',day,id};
       const result=leftChanged?left:right;
       if(result)mergedDay[id]=true;
     }
     if(Object.keys(mergedDay).length)mergedChecks[day]=mergedDay;
   }
   out.checks=mergedChecks;
   out.rewardedWeeks=[...new Set([...weeks[1],...weeks[2]])].sort();
   return {ok:true,state:out};
 }
 root.HabitQuestSyncMerge=Object.freeze({mergeCheckOnly});
})(typeof window==='undefined'?globalThis:window);

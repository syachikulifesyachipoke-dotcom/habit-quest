/* Protect current clients from silently replacing lifecycle history with a legacy snapshot.
   This does NOT prevent an old, still-open client from writing to the existing RPC.
   A database-side compatibility guard is required before this can be considered safe to ship. */
(function(root){
  'use strict';
  const meaningful=h=>h&&(
    typeof h.createdOn==='string'&&h.createdOn.length>0||
    Array.isArray(h.activeIntervals)&&h.activeIntervals.length>0||
    Array.isArray(h.targetHistory)&&h.targetHistory.length>0
  );
  const dates=arr=>new Set((Array.isArray(arr)?arr:[]).map(x=>x?.effectiveOn));
  const covers=(older,newer,key)=>{
    const before=Array.isArray(older?.[key])?older[key]:[];
    const after=Array.isArray(newer?.[key])?newer[key]:[];
    if(after.length<before.length)return false;
    if(key==='targetHistory'){
      const keys=dates(after);
      return before.every(x=>keys.has(x?.effectiveOn));
    }
    return before.every(x=>after.some(y=>y?.from===x?.from&&
      (y?.until===x?.until||y?.until===null&&x?.until!==null||y?.until!==null&&x?.until===null)));
  };
  function losses(preserved,proposed){
    if(!Array.isArray(preserved?.habits)||!Array.isArray(proposed?.habits))return [];
    const next=new Map(proposed.habits.filter(h=>h&&typeof h.id==='string').map(h=>[h.id,h]));
    const result=[];
    for(const h of preserved.habits){
      if(!meaningful(h))continue;
      const match=next.get(h.id);
      if(!match){result.push(h.id);continue}
      if((h.createdOn&&h.createdOn!==match.createdOn)||
        !covers(h,match,'targetHistory')||
        !covers(h,match,'activeIntervals')||
        typeof h.missionEnabled==='boolean'&&typeof match.missionEnabled!=='boolean'){
        result.push(h.id);
      }
    }
    return result;
  }
  root.HabitQuestSyncGuard=Object.freeze({losses});
})(typeof window==='undefined'?globalThis:window);

/* HABIT QUEST: non-destructive cloud onboarding classifier.
 * Only completely untouched starter state may be replaced on first login.
 * Local checks, changed habits, historical intervals or a different account
 * must NEVER be automatically overwritten by a remote snapshot.
 */
(function(root){
 'use strict';
 function canAdopt(raw,defaults,userId,ownerId){
  if(typeof userId!=='string'||!userId)return false;
  if(ownerId&&ownerId!==userId)return false;
  if(raw===null||raw===undefined||raw==='')return true;
  let s;
  try{s=JSON.parse(raw)}catch(_){return false}
  if(!s||!Array.isArray(s.habits)||!s.checks||typeof s.checks!=='object'||Array.isArray(s.checks))return false;
  if(Object.values(s.checks).some(day=>day&&typeof day==='object'&&Object.values(day).some(v=>v===true)))return false;
  if(Array.isArray(s.rewardedWeeks)&&s.rewardedWeeks.length)return false;
  if(Array.isArray(s.ouraAutoKeys)&&s.ouraAutoKeys.length)return false;
  if(Array.isArray(s.ouraSuppressedKeys)&&s.ouraSuppressedKeys.length)return false;
  if(s.ouraData&&Object.keys(s.ouraData).length)return false;
  if(!Array.isArray(defaults)||s.habits.length!==defaults.length)return false;
  const initial=new Map(defaults.map(h=>[h.id,h]));
  const seen=new Set();
  for(const h of s.habits){
   if(!h||typeof h.id!=='string'||seen.has(h.id))return false;
   seen.add(h.id);
   const d=initial.get(h.id);
   if(!d||h.name!==d.name||h.icon!==d.icon||Number(h.target)!==Number(d.target))return false;
   if(h.ouraTrackingOnly===true!==(d.ouraTrackingOnly===true))return false;
   if(typeof h.missionEnabled==='boolean'&&h.missionEnabled!==(!d.ouraTrackingOnly))return false;
   if(h.createdOn||Array.isArray(h.activeIntervals)&&h.activeIntervals.length||
      Array.isArray(h.targetHistory)&&h.targetHistory.length)return false;
  }
  return true;
 }
 root.HabitQuestCloudOnboard=Object.freeze({canAdopt});
})(typeof window==='undefined'?globalThis:window);

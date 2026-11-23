/* HABIT QUEST G6 Oura walking: STRICTLY more than 8,000 steps.
 * Oura workout tags must never auto-complete walking on or after cutoff.
 * Old check history is not deleted; historical step status is read-only.
 */
(function(root){
 'use strict';
 const WALKING_ID='oura_walking',MIN_STEPS=8001;
 const RULE_START='2026-11-23';
 const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
  !Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function numberOfSteps(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0&&n<=1000000?n:null;
 }
 function qualified(steps){const n=numberOfSteps(steps);return n!==null&&n>=MIN_STEPS}
 function status(steps){
  const n=numberOfSteps(steps);
  return n===null?'unknown':qualified(n)?'achieved':'under';
 }
 function walkingEligible(day){return validDay(day)&&day>=RULE_START}
 function stepsForDay(data,day){
  if(!validDay(day))return null;
  return numberOfSteps(data?.[day]?.steps);
 }
 function allHistory(data,today){
  return Object.keys(data||{}).filter(k=>validDay(k)&&(!today||k<=today))
   .sort().reverse().map(day=>({day,steps:stepsForDay(data,day),
    status:status(stepsForDay(data,day)),qualified:qualified(stepsForDay(data,day))}));
 }
 function qualifiedRecords(rows,today){
  return (Array.isArray(rows)?rows:[]).filter(r=>
   walkingEligible(r?.day)&&(!today||r.day<=today)&&qualified(r.steps))
   .map(r=>({day:r.day,id:WALKING_ID,label:'8,001歩以上のウォーキング'}));
 }
 root.HabitQuestOuraSteps=Object.freeze({
  WALKING_ID,MIN_STEPS,RULE_START,numberOfSteps,qualified,status,
  walkingEligible,stepsForDay,allHistory,qualifiedRecords
 });
})(typeof window==='undefined'?globalThis:window);

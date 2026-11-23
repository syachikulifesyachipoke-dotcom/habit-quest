/* HABIT QUEST G6 — three stable habit categories and independent streaks.
 * Existing habit IDs and pre-login history are preserved. No XP changes.
 */
(function(root){
 'use strict';
 const GROUPS=Object.freeze([
  Object.freeze({id:'investment',label:'自己投資',subtitle:'学びを積み重ねる',accent:'#a78bfa'}),
  Object.freeze({id:'wellbeing',label:'良習慣',subtitle:'毎日の土台をつくる',accent:'#f9ca83'}),
  Object.freeze({id:'exercise',label:'運動',subtitle:'身体を動かす',accent:'#5eead4'})
 ]);
 const known=Object.freeze({
  study:'investment',read:'investment',journal:'investment',
  wake:'wellbeing',
  oura_strengthtraining:'exercise',oura_cycling:'exercise',
  oura_walking:'exercise',oura_running:'exercise'
 });
 function cleanName(h){return String(h?.name||'').normalize('NFKC').replace(/[\s　・]/g,'').toLowerCase()}
 function groupFor(h){
  if(!h||typeof h!=='object')return 'other';
  if(known[h.id])return known[h.id];
  const name=cleanName(h);
  if(/(ビオフェルミン|biofermin|no酒|禁酒|断酒|飲酒しない)/i.test(name))return 'wellbeing';
  if(/(ジャーナル|日記|振り返り|読書|勉強|学習)/.test(name))return 'investment';
  if(/(ウォーキング|歩行|歩く|筋トレ|筋力トレ|サイクリング|自転車|ランニング|走る)/.test(name))return 'exercise';
  return GROUPS.some(g=>g.id===h.groupId)?h.groupId:'other';
 }
 const validDay=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k)&&
  !Number.isNaN(Date.parse(k+'T12:00:00Z'))&&
  new Date(k+'T12:00:00Z').toISOString().slice(0,10)===k;
 function before(k){const d=new Date(k+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
 function streak({habits,checks,today,start,activeOn}){
  const arr=Array.isArray(habits)?habits:[];
  const allChecks=checks&&typeof checks==='object'?checks:{};
  const active=typeof activeOn==='function'?activeOn:()=>true;
  const result={};
  for(const g of GROUPS){
   const items=arr.filter(h=>groupFor(h)===g.id);
   const anyDone=key=>items.some(h=>active(h,key)&&allChecks[key]?.[h.id]===true);
   let count=0;
   if(validDay(today)&&validDay(start)&&start<=today){
    let key=anyDone(today)?today:before(today);
    for(let limit=0;limit<20000&&key>=start&&validDay(key)&&anyDone(key);limit++){
     count++;key=before(key);
    }
   }
   result[g.id]={days:count,todayDone:validDay(today)&&anyDone(today),
    hasHabits:items.length>0,count:items.length};
  }
  return result;
 }
 function groupHabits(habits){
  const result={investment:[],wellbeing:[],exercise:[],other:[]};
  for(const h of Array.isArray(habits)?habits:[])result[groupFor(h)].push(h);
  return result;
 }
 root.HabitQuestGroups=Object.freeze({GROUPS,groupFor,groupHabits,streak});
})(typeof window==='undefined'?globalThis:window);

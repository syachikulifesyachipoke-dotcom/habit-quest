/* HABIT QUEST — Daily Adventure
 * Read-only game layer derived from existing habit checks. No XP, DB, or
 * existing reward changes. Historical and archived records remain intact.
 */
(function(root){
 'use strict';
 const BADGES=[
  {days:1,name:'旅立ちの証',icon:'🌱'},
  {days:3,name:'一歩の探検家',icon:'🧭'},
  {days:7,name:'七日の旅人',icon:'⛺'},
  {days:14,name:'習慣の冒険者',icon:'🛡️'},
  {days:30,name:'星を追う旅人',icon:'🌠'},
  {days:60,name:'道を拓く者',icon:'🗺️'},
  {days:100,name:'百日の開拓者',icon:'🏰'},
  {days:365,name:'永続の冒険者',icon:'👑'}
 ];
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
   !Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const dateToUTC=s=>new Date(s+'T12:00:00Z');
 const dayString=d=>d.toISOString().slice(0,10);
 const addDays=(key,n)=>{const d=dateToUTC(key);d.setUTCDate(d.getUTCDate()+n);return dayString(d)};
 const manual=h=>h&&typeof h.id==='string'&&h.id!=='wake'&&!h.id.startsWith('oura_')&&h.ouraTrackingOnly!==true;
 const checked=(checks,key,id)=>checks?.[key]?.[id]===true;
 function describe(input){
  const habits=Array.isArray(input?.habits)?input.habits:[];
  const checks=input?.checks&&typeof input.checks==='object'?input.checks:{};
  const today=validDate(input?.today)?input.today:null;
  const begin=validDate(input?.xpStartDate)?input.xpStartDate:null;
  const activeOn=typeof input?.activeOn==='function'?input.activeOn:()=>true;
  const archived=typeof input?.archived==='function'?input.archived:()=>false;
  const configOn=typeof input?.configOn==='function'?input.configOn:(h)=>({target:h.target,mission:!h.ouraTrackingOnly});
  const manualHabits=habits.filter(manual);
  if(!today)return {today:null,dayNodes:[],activeDays:0,todayDone:0,hasManualHabits:manualHabits.length>0,
    focus:null,badge:null,nextBadge:BADGES[0],weekDone:0,manualToday:0,allTodayDone:false};
  const weekDay=(dateToUTC(today).getUTCDay()+6)%7;
  const monday=addDays(today,-weekDay),sunday=addDays(monday,6);
  const hasManualDay=day=>manualHabits.some(h=>activeOn(h,day)&&checked(checks,day,h.id));
  const activityDays=new Set(Object.keys(checks).filter(key=>validDate(key)&&key<=today&&
    !!begin&&key>=begin&&hasManualDay(key)));
  const dayNodes=Array.from({length:7},(_,i)=>{
    const date=addDays(monday,i);
    return {date,label:['月','火','水','木','金','土','日'][i],done:activityDays.has(date),
      today:date===today,future:date>today,beforeStart:!!begin&&date<begin};
  });
  const todayHabits=manualHabits.filter(h=>!archived(h)&&activeOn(h,today));
  const todayDone=todayHabits.filter(h=>checked(checks,today,h.id)).length;
  const candidates=todayHabits.filter(h=>!checked(checks,today,h.id)).map((h,i)=>{
    const config=configOn(h,today)||{target:Number(h.target),mission:true};
    const goalDays=Array.from({length:7},(_,n)=>addDays(monday,n));
    const progress=goalDays.filter(key=>key<=today&&activeOn(h,key)&&checked(checks,key,h.id)).length;
    const target=Math.min(7,Number(config.target)||0);
    const remaining=config.mission?Math.max(0,target-progress):0;
    const activeRemaining=goalDays.filter(key=>key>=today&&activeOn(h,key)).length;
    return {id:h.id,name:h.name,remaining,priority:remaining&&activeRemaining?remaining/activeRemaining:0,i};
  });
  candidates.sort((a,b)=>b.priority-a.priority||a.i-b.i);
  const focus=candidates[0]||null;
  const activeDays=activityDays.size;
  const badge=[...BADGES].reverse().find(b=>activeDays>=b.days)||null;
  const nextBadge=BADGES.find(b=>activeDays<b.days)||null;
  return {
   today,monday,sunday,dayNodes,activeDays,weekDone:dayNodes.filter(d=>d.done).length,
   todayDone,manualToday:todayHabits.length,hasManualHabits:manualHabits.length>0,
   allTodayDone:todayHabits.length>0&&todayDone===todayHabits.length,
   focus,badge,nextBadge
  };
 }
 root.HabitQuestDailyAdventure=Object.freeze({describe,BADGES});
})(typeof window==='undefined'?globalThis:window);

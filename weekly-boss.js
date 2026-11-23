/* HABIT QUEST G6: a read-only weekly boss, powered by the SAME existing
 * weekly mission summary that unlocks the XP chest.
 * One capped weekly mission hit = 20 visual damage. No new XP/coins.
 */
(function(root){
 'use strict';
 const BOSSES=Object.freeze([
  Object.freeze({id:'warden',name:'夜霧の守護者',subtitle:'霧を切り裂き、次の道を拓け',tone:'violet'}),
  Object.freeze({id:'golem',name:'黒曜石の巨人',subtitle:'小さな一撃を積み重ねろ',tone:'gold'}),
  Object.freeze({id:'sentinel',name:'蒼晶の番人',subtitle:'静かな力を集めて挑もう',tone:'mint'}),
  Object.freeze({id:'shade',name:'星喰いの影',subtitle:'一歩ずつ星の光を取り戻せ',tone:'blue'})
 ]);
 const valid=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k)&&
  !Number.isNaN(Date.parse(k+'T12:00:00Z'));
 function describe(weekStart,weekly,awarded=false){
  if(!valid(weekStart))return null;
  const week=Math.floor(Date.parse(weekStart+'T12:00:00Z')/604800000);
  const boss=BOSSES[((week%BOSSES.length)+BOSSES.length)%BOSSES.length];
  const target=Math.max(0,Math.floor(Number(weekly?.target)||0));
  const done=Math.min(target,Math.max(0,Math.floor(Number(weekly?.done)||0)));
  // Chest +100XP is intentionally irreversible after being earned.
  // A boss must not resurrect when a user later edits an old checked habit.
  const retained=awarded===true;
  const isDefeated=retained||(target>0&&done>=target);
  const totalHp=target*20,damage=isDefeated?totalHp:done*20,left=Math.max(0,totalHp-damage);
  return {...boss,weekStart,target,done,totalHp,damage,hp:left,
   percent:totalHp===0?(retained?100:0):Math.round(100*damage/totalHp),
   state:isDefeated?'defeated':target===0?'no-mission':done===0?'waiting':'fighting',
   isDefeated,awardRetained:retained&&done<target};
 }
 root.HabitQuestWeeklyBoss=Object.freeze({BOSSES,describe});
})(typeof window==='undefined'?globalThis:window);

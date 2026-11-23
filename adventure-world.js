/* HABIT QUEST — exploration world (G2)
 * A visual, deterministic RPG journey derived from existing manual-check days.
 * No extra XP, consumable currency, telemetry, network requests, or new state.
 */
(function(root){
 'use strict';
 const REGIONS=Object.freeze([
  {id:'camp',at:0,icon:'🏕️',name:'旅立ちの野営地',subtitle:'世界の扉が開く場所',relic:'はじまりの地図',relicIcon:'🗺️',tint:'#a78bfa',story:'まだ何も書かれていない地図。相棒が小さな足跡を一つ見つけ、あなたの旅が始まります。'},
  {id:'forest',at:2,icon:'🌲',name:'ほたるの森',subtitle:'夜に浮かぶ光を追って',relic:'ほたるのランタン',relicIcon:'🏮',tint:'#5eead4',story:'森に灯る小さな光は、一歩ごとに道を照らします。昨日と違う景色が見えてきました。'},
  {id:'hill',at:5,icon:'🍃',name:'風鳴りの丘',subtitle:'見晴らしのよい風の道',relic:'風の羅針盤',relicIcon:'🧭',tint:'#93c5fd',story:'丘のてっぺんで風が新しい道を指し示します。遠くにまだ知らない町が見えます。'},
  {id:'library',at:10,icon:'📜',name:'古書の街',subtitle:'忘れられた物語の街',relic:'旅人の古書',relicIcon:'📖',tint:'#f9c66a',story:'古い本には、誰かが小さな一歩を積み重ねた記録がありました。あなたの物語も増えています。'},
  {id:'valley',at:20,icon:'🌫️',name:'霧深い谷',subtitle:'見えない先へ進む勇気',relic:'霧除けの鈴',relicIcon:'🔔',tint:'#c4b5fd',story:'先の道はまだ見えません。相棒は急がず、すぐ足元の小道を照らしています。'},
  {id:'port',at:40,icon:'⚓',name:'蒼海の港',subtitle:'次の大陸へ旅立つ港',relic:'蒼海の貝殻',relicIcon:'🐚',tint:'#67e8f9',story:'港に着いた二人は、これまでの道を振り返ります。遠い旅は、毎日の短い歩みから生まれました。'},
  {id:'peak',at:70,icon:'⛰️',name:'雷雲の峰',subtitle:'雲の上の静かな高み',relic:'雷光の結晶',relicIcon:'💠',tint:'#fde68a',story:'山の上には静かな空が広がっています。どれだけ時間がかかっても、ここまで来た足跡は消えません。'},
  {id:'ruins',at:120,icon:'🌙',name:'月影の遺跡',subtitle:'月明かりが導く秘密',relic:'月の鍵',relicIcon:'🗝️',tint:'#d8b4fe',story:'遺跡の扉に刻まれた文字が光ります。相棒と重ねた日々が、静かな鍵になりました。'},
  {id:'observatory',at:200,icon:'🔭',name:'星の天文台',subtitle:'数えきれない星の道',relic:'星読みのレンズ',relicIcon:'🔮',tint:'#c4b5fd',story:'見上げた空には、過去に残した足跡が星座のようにつながっています。'},
  {id:'sky',at:365,icon:'🌌',name:'永遠の空庭',subtitle:'冒険はこれからも続く',relic:'永遠の星',relicIcon:'💫',tint:'#f9df9e',story:'大きな旅を歩んだ二人は、次の景色を探しに出ます。ゴールは、また新しい出発点です。'}
 ]);
 const ENCOUNTERS=Object.freeze([
  '相棒が足元に小さな星のかけらを見つけました。今日の一歩が宝物になりました。',
  '旅人から新しい道の話を聞きました。見知らぬ景色への好奇心が広がります。',
  'そよ風が二人の背中を押してくれます。焦らず歩く旅もいいものです。',
  '道の端に、昨日は気づかなかった花が咲いています。',
  '相棒が不思議な足跡を見つけました。次の冒険の予感がします。',
  '遠くで鐘が鳴っています。歩んだ分だけ地図が少しずつ広がります。',
  '夜空の星が、今日だけの道しるべを描いています。',
  '近くの冒険者とたき火を囲みました。続ける工夫を聞けたようです。',
  '相棒が宝箱を見つけました。中身は今日積み重ねた小さな自信でした。',
  '景色が開け、これまでの足跡が遠くまで続いているのが見えました。',
  '道ばたで古い歌を教わりました。今日の記憶を胸にしまいます。',
  'あたたかな光が道を照らします。相棒も少し誇らしげです。',
  '通り雨がやむと、小さな虹がかかりました。雨の日も旅の一部です。',
  '森の案内人から手書きの目印をもらいました。新しい道を選べそうです。',
  '相棒が休憩を提案しました。急ぐ日も、のんびりする日も大切です。',
  '地図の余白に新しい線を描きました。自分だけの旅が続いています。'
 ]);
 function safeDays(value){return Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0}
 function regionFor(days){
  const count=safeDays(days);
  for(let i=REGIONS.length-1;i>=0;i--)if(count>=REGIONS[i].at)return i;
  return 0;
 }
 function encounterFor(date,regionIndex){
  // Stable across devices: independent of locale, JS random state and XP.
  const seed=String(date||'')+'|'+REGIONS[Math.min(Math.max(regionIndex,0),REGIONS.length-1)].id;
  let h=2166136261;
  for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619)>>>0;
  return ENCOUNTERS[h%ENCOUNTERS.length];
 }
 function describe(daily){
  const days=safeDays(daily?.activeDays);
  const index=regionFor(days),current=REGIONS[index],next=REGIONS[index+1]||null;
  const untilNext=next?Math.max(0,next.at-days):0;
  const segment=next?next.at-current.at:1;
  const progress=next?Math.max(0,Math.min(100,Math.round(100*(days-current.at)/segment))):100;
  const dates=Array.isArray(daily?.activityDates)?daily.activityDates.filter(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)).sort():[];
  const unlocked=REGIONS.map((region,i)=>({...region,index:i,unlocked:i<=index,next:i===index+1}));
  const diary=dates.slice(-5).reverse().map(day=>{
   const dayNumber=dates.indexOf(day)+1,area=REGIONS[regionFor(dayNumber)];
   return {day,date:day,regionId:area.id,regionName:area.name,icon:area.icon,text:encounterFor(day,regionFor(dayNumber)),dayNumber};
  });
  const today=typeof daily?.today==='string'?daily.today:null;
  const doneToday=!!today&&dates.includes(today)&&Number(daily?.todayDone)>0;
  return {
   days,current,index,next,untilNext,progress,unlocked,diary,
   discovered:unlocked.filter(x=>x.unlocked).length,total:REGIONS.length,
   todayScene:doneToday?diary.find(item=>item.date===today)||null:null,
   todayReady:doneToday,
   hasManualHabits:!!daily?.hasManualHabits,
   today
  };
 }
 root.HabitQuestWorld=Object.freeze({describe,REGIONS,encounterFor});
})(typeof window==='undefined'?globalThis:window);

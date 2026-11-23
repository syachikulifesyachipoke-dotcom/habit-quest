/* HABIT QUEST — five-screen game shell (G3).
 * Pure gameplay descriptions only. Screens, reactions and equipment are rendered
 * by index.html from existing check history. No paid checkout or XP side effects.
 */
(function(root){
 'use strict';
 const TABS=Object.freeze(['home','character','events','shop','options']);
 const CHAPTERS=Object.freeze([
  {day:1,title:'旅のはじまり',icon:'🌱',story:'まだ白紙の地図を手に、相棒と最初の一歩を踏み出した。小さな一歩でも、冒険はここから始まる。'},
  {day:2,title:'ひかりの道しるべ',icon:'✨',story:'森の入口で、相棒が光る足跡を見つけた。昨日の一歩が、今日の道を照らしている。'},
  {day:3,title:'風が運ぶ手紙',icon:'💌',story:'風に乗って届いた古い手紙には、「続ける道にこそ、まだ知らない景色がある」と書かれていた。'},
  {day:4,title:'ちいさな勇気',icon:'🛡️',story:'道に迷っても相棒は笑っていた。完璧な旅より、歩き出した日の数が二人の自信になる。'},
  {day:5,title:'丘からの眺め',icon:'⛰️',story:'少し高い丘に登ると、地図に見たことのない場所が現れた。世界が思ったより大きいことに気づく。'},
  {day:6,title:'星明かりの約束',icon:'🌟',story:'夜空の下、相棒は今日の冒険を日誌に書き留めた。続けてきた時間が、二人だけの宝物になった。'},
  {day:7,title:'最初の七日、そして次へ',icon:'🏆',story:'最初の七つの足跡が、星座のようにつながった。物語はこれで終わらない。次の世界が待っている。'}
 ]);
 const FRAMES=Object.freeze([
  {id:'classic',days:0,name:'はじまりの額縁',icon:'🪵',description:'相棒と歩く、最初の冒険の飾り。'},
  {id:'forest',days:2,name:'ほたるの光',icon:'🌿',description:'森の光が相棒のまわりを彩る。'},
  {id:'starlight',days:7,name:'星くずのきらめき',icon:'✨',description:'七つの足跡をたどる星の飾り。'},
  {id:'moon',days:30,name:'月影のやすらぎ',icon:'🌙',description:'長い旅を見守る月明かり。'},
  {id:'royal',days:100,name:'探検王のひかり',icon:'👑',description:'百日の冒険にふさわしい特別な額縁。'}
 ]);
 function describe(daily,world,level){
  const n=Math.max(0,Math.floor(Number(daily?.activeDays)||0));
  const todayDone=Math.max(0,Number(daily?.todayDone)||0);
  const todayTotal=Math.max(0,Number(daily?.manualToday)||0);
  const complete=todayTotal>0&&todayDone===todayTotal;
  const reaction=!daily?.hasManualHabits?'どんな冒険を始めよう？ 習慣をひとつ決めてみよう！':
    todayTotal===0?'今日は休憩の日だね。また一緒に旅を始めよう。':
    complete?'すごい！ 今日の冒険、ぜんぶ達成だね！':
    todayDone>0?'やったね！ 一歩ずつ、世界が広がっているよ。':
    '今日はどんな一歩を踏み出そう？ 僕も一緒だよ！';
  const mood=!daily?.hasManualHabits||todayTotal===0?'rest':complete?'celebrate':todayDone>0?'happy':'ready';
  const activeChapter=CHAPTERS[Math.min(n,7)-1]||null;
  const nextChapter=CHAPTERS.find(c=>c.day>n)||null;
  const completedChapters=CHAPTERS.filter(c=>n>=c.day).length;
  const unlockedFrames=FRAMES.filter(c=>n>=c.days);
  return {reaction,mood,completedChapters,activeChapter,nextChapter,chapters:CHAPTERS,
    frames:FRAMES,unlockedFrames,activeDays:n,
    chapterProgress:Math.round(100*completedChapters/CHAPTERS.length),
    allSevenComplete:n>=7,worldName:world?.current?.name||'旅立ちの野営地',
    level:Math.max(1,Math.floor(Number(level)||1))};
 }
 root.HabitQuestGameShell=Object.freeze({TABS,CHAPTERS,FRAMES,describe});
})(typeof window==='undefined'?globalThis:window);

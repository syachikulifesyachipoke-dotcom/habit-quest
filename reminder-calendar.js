/* HABIT QUEST G6: free opt-in calendar reminder generator.
 * A browser cannot force another app to open at a chosen time. This creates a
 * user-importable recurring event with a calendar notification and app URL.
 * No background server, paid push provider or notification permission needed.
 */
(function(root){
 'use strict';
 const validTime=t=>typeof t==='string'&&/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(t);
 function escapeIcs(x){return String(x).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
 function nextJapanDate(time,now){
  if(!validTime(time))throw new Error('Invalid reminder time');
  const t=new Date(now??Date.now());
  const japan=new Date(t.getTime()+9*60*60000);
  const day=japan.toISOString().slice(0,10);
  const clock=japan.toISOString().slice(11,16);
  const candidate=new Date(day+'T'+time+':00+09:00');
  if(clock>=time)candidate.setUTCDate(candidate.getUTCDate()+1);
  return new Date(candidate.getTime()+9*60*60000).toISOString().slice(0,10).replaceAll('-','');
 }
 function calendarFile(time,now,home='https://syachikulifesyachipoke-dotcom.github.io/habit-quest/'){
  if(!validTime(time))throw new Error('Invalid reminder time');
  if(typeof home!=='string'||!/^https:\/\//.test(home))throw new Error('Secure URL required');
  const d=nextJapanDate(time,now);
  const hhmm=time.replace(':','');
  const uid='habit-quest-daily-'+hhmm+'@habit-quest.local';
  const summary=escapeIcs('HABIT QUEST｜今日の冒険へ');
  const desc=escapeIcs('今日の習慣を確認しましょう。通知をタップし、ゲームを開いてください。 '+home);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HABIT QUEST//Daily Reminder//JA',
   'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-TIMEZONE:Asia/Tokyo',
   'BEGIN:VTIMEZONE','TZID:Asia/Tokyo','BEGIN:STANDARD','DTSTART:19700101T000000',
   'TZOFFSETFROM:+0900','TZOFFSETTO:+0900','TZNAME:JST','END:STANDARD','END:VTIMEZONE',
   'BEGIN:VEVENT','UID:'+uid,'DTSTAMP:20261123T000000Z',
   'DTSTART;TZID=Asia/Tokyo:'+d+'T'+hhmm+'00','DURATION:PT1M',
   'RRULE:FREQ=DAILY','SUMMARY:'+summary,'DESCRIPTION:'+desc,
   'URL:'+home,'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY',
   'DESCRIPTION:'+escapeIcs('HABIT QUESTの時間です'),'END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
 }
 root.HabitQuestReminder=Object.freeze({validTime,nextJapanDate,calendarFile});
})(typeof window==='undefined'?globalThis:window);

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = html.split('<script>')[1].split('</script>')[0];
function extract(pattern) {
  const match = js.match(pattern);
  assert.ok(match, 'missing function matching '+pattern);
  return match[0];
}
const fns = [
  extract(/function validXpStartDate\(day\)\{[\s\S]*?\n\}/),
  extract(/function habitCreatedOn\(h\)\{[^\n]+\}/),
  extract(/function eligibleHabitDay\(h,key\)\{[^\n]+\}/),
  extract(/function weeklyFor\(start\)\{[\s\S]*?\n\}/)
].join('\n');
const checks = {};
const state = {habits:[]};
const key = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const context = {
  state,
  dayKey:key,
  weekDays:d=>Array.from({length:7},(_,i)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+i,12)),
  xpStartDate:()=> '2026-11-23',
  checked:(d,id)=>Boolean(checks[key(d)]?.[id])
};
vm.runInNewContext(fns+'\nthis.testApi={eligibleHabitDay,weeklyFor};',context);
const api=context.testApi;
const monday = new Date(2026,10,23,12);

test('new habit only enters denominators from its createdOn date',()=>{
  assert.equal(api.eligibleHabitDay({createdOn:'2026-11-26'},'2026-11-25'),false);
  assert.equal(api.eligibleHabitDay({createdOn:'2026-11-26'},'2026-11-26'),true);
  assert.equal(api.eligibleHabitDay({createdOn:null},'2025-11-26'),true);
});

test('adding a habit midweek does not retroactively require seven earlier checks',()=>{
  state.habits=[{id:'old',target:3,ouraTrackingOnly:false},{id:'new',target:7,createdOn:'2026-11-26',ouraTrackingOnly:false}];
  for(const date of Object.keys(checks))delete checks[date];
  for(const day of ['2026-11-23','2026-11-24','2026-11-25'])checks[day]={old:true};
  for(const day of ['2026-11-26','2026-11-27','2026-11-28','2026-11-29'])checks[day]={...checks[day],new:true};
  const result=api.weeklyFor(monday);
  assert.equal(result.target,7); // 3 old + 4 days of new
  assert.equal(result.done,7);
  assert.equal(result.complete,true);
  delete checks['2026-11-29'].new;
  const short=api.weeklyFor(monday);
  assert.equal(short.done,6);
  assert.equal(short.complete,false);
});

test('first login date is an independent cut-off even for legacy habits',()=>{
  state.habits=[{id:'old',target:7,ouraTrackingOnly:false}];
  const week=new Date(2026,10,16,12);
  const result=api.weeklyFor(week);
  assert.equal(result.target,0);
  assert.equal(result.complete,false);
});

test('habit creation date travels through the existing cloud JSON payload',()=>{
  assert.match(js,/createdOn:isoToday\(\)/);
  assert.match(js,/createdOn:validXpStartDate\(h\.createdOn\)/);
  assert.match(js,/habits:s\.habits/);
  assert.match(js,/eligibleHabitDay\(h,dayKey\(d\)\)/);
});

test('manual edit explicitly controls weekly mission membership',()=>{
  assert.match(html,/id="habitWeeklyMission"/);
  assert.match(js,/ouraTrackingOnly=!\$\('habitWeeklyMission'\)\.checked/);
  assert.match(js,/\$\('habitWeeklyMission'\)\.checked=h\?!h\.ouraTrackingOnly:true/);
});

test('existing habit deletion retains check history and XP',()=>{
  assert.match(js,/state\.habits=state\.habits\.filter\(x=>x\.id!==editing\)/);
  assert.match(js,/過去のチェック記録と獲得したXPは残ります/);
});

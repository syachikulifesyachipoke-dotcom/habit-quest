import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'goal-metrics.js'), 'utf8');
const sandbox = {window:{}};
vm.runInNewContext(code,sandbox,{filename:'goal-metrics.js'});
const calculate = sandbox.window.HabitQuestGoalMetrics.compute;

test('weekly target 3 of 7 is met by three checks, not penalized as 43%',()=>{
 const r=calculate(3,7,3);
 assert.equal(r.goalCount,3);
 assert.equal(r.goalRate,100);
 assert.equal(r.counted,3);
});
test('weekly target 3 with only two checks is 67%',()=>{
 const r=calculate(2,7,3);
 assert.equal(r.goalCount,3);
 assert.equal(r.goalRate,67);
});
test('thirty-day target is prorated and rounded up',()=>{
 const r=calculate(13,30,3);
 assert.equal(r.goalCount,13);
 assert.equal(r.goalRate,100);
});
test('weekly equivalent target is capped at 100% without discarding real check days',()=>{
 const r=calculate(6,7,3);
 assert.equal(r.counted,3);
 assert.equal(r.goalRate,100);
});
test('only observed days count toward the denominator when Oura is missing',()=>{
 const r=calculate(2,4,3);
 assert.equal(r.goalCount,2);
 assert.equal(r.goalRate,100);
});
test('no observed days means no judgement',()=>{
 const r=calculate(0,0,3);
 assert.equal(r.goalRate,null);
 assert.equal(r.goalCount,null);
});
test('invalid weekly goals are not treated as success or failure',()=>{
 for(const goal of [0,8,NaN,null]) {
  const r=calculate(2,7,goal);
  assert.equal(r.goalRate,null);
 }
});
test('incorrect data cannot exceed observed days',()=>{
 assert.equal(calculate(8,7,3).goalRate,null);
});

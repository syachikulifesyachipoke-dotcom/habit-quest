/* HABIT QUEST Phase A-1: transparent weekly-goal-equivalent progress.
 * No cloud state or XP data is changed by this helper. */
(function (root) {
  'use strict';
  function compute(done, observed, weeklyTarget) {
    const completed = Number(done);
    const measuredDays = Number(observed);
    const target = Number(weeklyTarget);
    if (!Number.isFinite(completed) || completed < 0 ||
        !Number.isFinite(measuredDays) || measuredDays <= 0 ||
        completed > measuredDays || !Number.isInteger(target) || target < 1 || target > 7) {
      return { goalCount: null, goalRate: null, counted: null };
    }
    // A fixed rolling window: prorate the weekly target to observed days,
    // then round up to a whole action. Missing Oura days do not count as failures.
    const goalCount = Math.ceil(target * measuredDays / 7);
    return {
      goalCount,
      goalRate: Math.min(100, Math.round(completed * 100 / goalCount)),
      counted: Math.min(completed, goalCount)
    };
  }
  function computeForDays(days) {
    const eligible=(Array.isArray(days)?days:[]).filter(d=>d&&d.observed===true&&d.mission===true&&
      Number.isInteger(Number(d.target))&&Number(d.target)>=1&&Number(d.target)<=7);
    if(!eligible.length) return {goalCount:null,goalRate:null,counted:null,goalObserved:0,goalDone:0};
    const goalCount=Math.ceil(eligible.reduce((sum,d)=>sum+Number(d.target),0)/7);
    const goalDone=eligible.filter(d=>d.done===true).length;
    return {goalCount,goalRate:Math.min(100,Math.round(goalDone*100/goalCount)),
      counted:Math.min(goalDone,goalCount),goalObserved:eligible.length,goalDone};
  }
  root.HabitQuestGoalMetrics = Object.freeze({ compute,computeForDays });
})(typeof window === 'undefined' ? globalThis : window);

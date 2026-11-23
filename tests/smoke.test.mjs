import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const cfg = read('cloud-config.js');

test('inline app JavaScript compiles without syntax errors', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).filter(Boolean);
  assert.equal(scripts.length, 1, 'expected a single inline application script');
  assert.doesNotThrow(() => new vm.Script(scripts[0], {filename:'index.inline.js'}));
});

test('static HTML IDs are unique', () => {
  const markup = html.split('<script>')[0];
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('homepage prioritizes RPG avatar on mobile', () => {
  assert.match(html, /main>\.intro\{order:0!important/);
  assert.match(html, /main>\.content\{order:1!important/);
});

test('weekly matrix and all automatic habit rows remain accessible', () => {
  assert.match(html, /\.track-head,\.habit-row\{min-width:315px/);
  const oldCollapse = html.indexOf('.tracker:not(.auto-open) .habit-row--auto{display:none}');
  const newOverride = html.indexOf('.tracker:not(.auto-open) .habit-row--auto{display:grid!important}');
  assert.ok(oldCollapse >= 0 && newOverride > oldCollapse, 'later rule must override the old mobile collapse');
  assert.match(html, /const group=isOuraAutoHabit\(h\)\?'auto':'manual'/);
});

test('today counts every registered habit, but streak is explicitly manual', () => {
  assert.match(html, /displayHabits\(\)\.filter\(h=>checked\(t,h\.id\)\)\.length/);
  assert.match(html, /連続記録日数（手動1項目以上）/);
  assert.match(html, /週間ミッションONの習慣の目標合計/);
});

test('individual habit drill-down and all five analysis periods exist', () => {
  assert.match(html, /data-detail="\$\{esc\(h\.id\)\}"/);
  assert.match(html, /function openHabitDetail\(id\)/);
  for (const n of [7,30,90,180,365]) {
    assert.match(html, new RegExp('<option value="'+n+'"'));
  }
  assert.match(html, /id="metricRating"/);
  assert.match(html, /\$\{a\.done\} \/ \$\{a\.observed\}日/);
});

test('Oura missing days are not counted as observed', () => {
  assert.match(html, /if\(missing\)continue;/);
  assert.match(html, /observed\+\+;/);
  assert.match(html, /(?:isOuraMissing|ouraCoverageDays)/);
});

test('XP excludes pre-first-login check marks and has level 50 cap', () => {
  assert.match(html, /if\(begin&&day>=begin\)xpChecks\+\+/);
  assert.match(html, /HabitQuestLifecycle\.weekProgress/);
  assert.match(html, /MAX_LEVEL=50/);
});

test('unsupported Oura types are suppressed', () => {
  assert.match(html, /'oura_pilates','oura_dance'/);
});

test('images and Oura controls are nested under settings', () => {
  const parent=html.indexOf('id="settingsDetail"');
  const art=html.indexOf('id="artSection"');
  const oura=html.indexOf('id="ouraDetail"');
  assert.ok(parent>=0 && art>parent && oura>art);
  assert.match(html, /id="settingsDetail"/);
  assert.match(html, /id="cloudToggle"/);
});

test('public frontend config has no server secrets', () => {
  assert.doesNotMatch(cfg, /sb_secret_|SUPABASE_SERVICE_ROLE_KEY|OURA_CLIENT_SECRET|OURA_TOKEN_KEY/);
  assert.match(cfg, /sb_publishable_/);
});

test('offline cache names are explicitly versioned', () => {
  assert.match(sw, /habit-quest-offline-v[0-9]+/);
  assert.match(sw, /\.\/index\.html/);
});

test('PWA manifest is valid JSON', () => {
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.ok(manifest.name && manifest.icons?.length);
});

test('goal metric module is loaded before app and in offline cache', () => {
  assert.match(html, /<script src="\.\/goal-metrics\.js"><\/script>\s*<script src="\.\/habit-lifecycle\.js"><\/script>\s*<script src="\.\/sync-guard\.js"><\/script>\s*<script src="\.\/sync-merge\.js"><\/script>\s*<script src="\.\/daily-adventure\.js"><\/script>\s*<script src="\.\/adventure-world\.js"><\/script>\s*<script src="\.\/cloud-onboarding\.js"><\/script>\s*<script src="\.\/game-shell\.js"><\/script>\s*<script src="\.\/coin-shop\.js"><\/script>\s*<script>/);
  assert.match(html, /id="metricGoal"/);
  assert.match(html, /window\.HabitQuestGoalMetrics\.compute/);
  assert.match(sw, /\.\/goal-metrics\.js/);
});

test('phase A-2 lifecycle module is loaded and cached offline',()=>{
 assert.match(html, /<script src="\.\/habit-lifecycle\.js"><\/script>\s*<script src="\.\/sync-guard\.js"><\/script>\s*<script src="\.\/sync-merge\.js"><\/script>\s*<script src="\.\/daily-adventure\.js"><\/script>\s*<script src="\.\/adventure-world\.js"><\/script>\s*<script src="\.\/cloud-onboarding\.js"><\/script>\s*<script src="\.\/game-shell\.js"><\/script>\s*<script src="\.\/coin-shop\.js"><\/script>\s*<script>/);
 assert.match(sw, /\.\/habit-lifecycle\.js/);
 assert.match(html, /id="archiveJump"/);
 assert.match(html, /id="archiveCount"/);
});

test('streak remains a manual-habit metric even when mission setting changes',()=>{
 assert.match(html,/const anyDone=k=>state\.habits\.some\(h=>\{const day=dayKey\(k\);return !isOuraAutoHabit\(h\)&&eligibleHabitDay\(h,day\)/);
 assert.match(html,/手動習慣を1項目以上達成した連続日数/);
});

test('sync safety guard is loaded and refuses downgrades before auto-replacement',()=>{
 assert.match(html, /function missingLifecycleFrom\(previous,next\)/);
 assert.match(html, /missingLifecycleFrom\(state,latest\.data\)/);
 assert.match(html, /missingLifecycleFrom\(cloud\.remote\.data,snapshot\)/);
 assert.match(sw, /\.\/sync-guard\.js/);
});

test('Phase A-3 strict sync merge is loaded for browser and PWA offline',()=>{
 assert.match(html, /<script src="\.\/sync-merge\.js"><\/script>\s*<script src="\.\/daily-adventure\.js"><\/script>\s*<script src="\.\/adventure-world\.js"><\/script>\s*<script src="\.\/cloud-onboarding\.js"><\/script>\s*<script src="\.\/game-shell\.js"><\/script>\s*<script src="\.\/coin-shop\.js"><\/script>\s*<script>/);
 assert.match(sw, /\.\/sync-merge\.js/);
 assert.match(html, /reconcileIndependentChecks\(latest\)/);
});

test('daily adventure is integrated with RPG and does not change xp rewards',()=>{
 assert.match(html, /id="dailyQuestTitle"/);
 assert.match(html, /id="journeyDays"/);
 assert.match(html, /window\.HabitQuestDailyAdventure\.describe/);
 assert.match(html, /renderDailyAdventure\(today\)/);
 assert.match(sw, /\.\/daily-adventure\.js/);
 assert.match(html, /今日の冒険：まずは1つ/);
});

test('exploration world is loaded and cached with accessible map and diary',()=>{
 assert.match(html, /id="worldPeekName"/);
 assert.match(html, /id="worldMapDialog"/);
 assert.match(html, /id="worldMapList"/);
 assert.match(html, /id="worldDiaryList"/);
 assert.match(html, /renderWorldExploration\(data\)/);
 assert.match(html, /window\.HabitQuestWorld\.describe/);
 assert.match(sw, /\.\/adventure-world\.js/);
});

test('pristine-device cloud auto-adoption helper is cached and loaded',()=>{
 assert.match(html, /<script src="\.\/cloud-onboarding\.js"><\/script>\s*<script src="\.\/game-shell\.js"><\/script>\s*<script src="\.\/coin-shop\.js"><\/script>\s*<script>/);
 assert.match(sw, /\.\/cloud-onboarding\.js/);
 assert.match(html, /HabitQuestCloudOnboard\.canAdopt/);
});

test('five fixed navigation buttons link to live character/event/shop/options panels',()=>{
 for(const key of ['home','character','events','shop','options']){
  assert.match(html,new RegExp('data-game-tab="'+key+'"'));
  assert.match(html,new RegExp('id="screen-'+key+'"'));
 }
 assert.match(html,/id="characterPat"/);
 assert.match(html,/id="eventChapters"/);
 assert.match(html,/id="shopFrames"/);
 assert.match(html,/id="cloudToggle"/);
 assert.match(html,/function initGameShell\(/);
 assert.match(html,/function setGameScreen\(/);
 assert.match(html,/function showGameUnlock\(/);
 assert.match(html,/id="gameUnlockDialog"/);
 assert.match(html,/href="\.\/game-shell\.css"/);
 assert.match(sw,/\.\/game-shell\.js/);
 assert.match(sw,/\.\/game-shell\.css/);
});

test('game expressions and direct options backup controls remain integrated',()=>{
 assert.doesNotMatch(html,/id="homeCompanionMood"|id="characterMoodFace"/);
 assert.match(html,/id="characterReactionText"/);
 assert.match(html,/dataset\.mood/);
 assert.match(html,/id="optionsExportBtn"/);
 assert.match(html,/id="optionsImportBtn"/);
 assert.match(html,/id="appUpdateBanner"/);
 assert.match(html,/id="syncBanner"/);
 assert.match(html,/previousController/);
 assert.match(html,/screen-options/);
});

test('G4 server coin shop and dark navigation assets are loaded and precached',()=>{
 assert.match(html, /<script src="\.\/coin-shop\.js"><\/script>\s*<script>/);
 assert.match(html, /<link rel="stylesheet" href="\.\/coin-shop\.css">/);
 assert.match(sw, /\.\/coin-shop\.js/);
 assert.match(sw, /\.\/coin-shop\.css/);
 for(const id of ['coinBalance','coinFreeGacha','coinShopItems','coinResultDialog','coinRefresh','coinGearOnCharacter']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/hq_game_action/);
 assert.match(html,/gameWalletAction\('refresh'\)/);
 assert.match(html,/HabitQuestCoinShop\.gameDayUTC/);
 assert.match(read('coin-shop.css'),/linear-gradient\(165deg,rgba\(30,35,61/);
});

test('header has only persistent XP and cloud coin counters, while account controls live in options',()=>{
 const header=html.slice(html.indexOf('<header'),html.indexOf('</header>')+9);
 const options=html.slice(html.indexOf('id="screen-options"'),html.indexOf('id="gameBottomNav"'));
 for(const id of ['headerXp','headerCoins']){
  assert.match(header,new RegExp('id="'+id+'"'));
 }
 for(const oldId of ['nowDate','settingsJump','cloudToggle']){
  assert.doesNotMatch(header,new RegExp('id="'+oldId+'"'));
 }
 assert.match(options,/id="cloudToggle"/);
 assert.match(html,/\$\('headerXp'\)\.textContent=s\.xp\.toLocaleString/);
 assert.match(html,/\$\('headerCoins'\)\.textContent=w\?w\.coins\.toLocaleString/);
 assert.doesNotMatch(html,/id="homeCompanionMood"|id="characterMoodFace"/);
 assert.doesNotMatch(read('game-shell.css'),/companion-mood-chip|char-mood-face/);
 assert.match(html, /<link rel="stylesheet" href="\.\/resource-hud\.css">/);
 assert.match(sw, /\.\/resource-hud\.css/);
});

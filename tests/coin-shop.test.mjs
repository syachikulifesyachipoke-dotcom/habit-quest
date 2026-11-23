import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const box={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'coin-shop.js'),'utf8'),box);
const {ITEMS,normalize,gameDayUTC,itemById}=box.window.HabitQuestCoinShop;
const sql=fs.readFileSync(path.join(root,'supabase/migrations/g4_cosmetic_wallet.sql'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('market has exactly five reasonably spaced cosmetic item costs',()=>{
 assert.equal(ITEMS.length,5);
 assert.deepEqual(Array.from(ITEMS,x=>x.price),[60,100,140,200,280]);
 assert.equal(new Set(Array.from(ITEMS,x=>x.id)).size,5);
 for(const item of ITEMS){
  assert.ok(item.icon&&item.name&&item.description&&item.rarity);
  assert.ok(sql.includes("when '"+item.id+"' then "+item.price),'server cost missing for '+item.id);
 }
});
test('daily gacha weights are disclosed and total 100%',()=>{
 assert.deepEqual(Array.from(ITEMS,x=>x.chance),[35,30,20,10,5]);
 assert.equal(ITEMS.reduce((n,i)=>n+i.chance,0),100);
 assert.match(sql,/v_roll<35/);
 assert.match(sql,/v_roll<65/);
 assert.match(sql,/v_roll<85/);
 assert.match(sql,/v_roll<95/);
});
test('JST 05:40 is a strict new game-day cutoff independent of device locale',()=>{
 assert.equal(gameDayUTC(Date.parse('2026-11-23T20:39:59Z')),'2026-11-23');
 assert.equal(gameDayUTC(Date.parse('2026-11-23T20:40:00Z')),'2026-11-24');
 assert.equal(gameDayUTC(Date.parse('2026-11-24T00:00:00Z')),'2026-11-24');
 assert.equal(gameDayUTC(Date.parse('2026-11-23T14:59:00Z')),'2026-11-23');
 assert.match(sql,/time zone 'Asia\/Tokyo'/);
 assert.match(sql,/interval '5 hours 40 minutes'/);
});
test('incoming wallet normalization is defensive and does not trust unknown ids',()=>{
 assert.equal(normalize(null),null);
 assert.equal(normalize({coins:-1}),null);
 assert.equal(normalize({coins:'wrong'}),null);
 const data=normalize({coins:100,items:['cloak','cloak','fake'],equipped:'fake',gachaUsed:true,
  gameDay:'2026-11-23',yesterdayChecks:4,yesterdayCoins:20,earnedNow:10});
 assert.deepEqual(Array.from(data.items),['cloak']);
 assert.equal(data.equipped,null);
 assert.equal(data.coins,100);
 assert.equal(data.gachaUsed,true);
 assert.equal(data.yesterdayChecks,4);
 assert.equal(itemById('fake'),null);
});
test('wallet is not in client cloudSnapshot, preserving existing XP and Oura schema',()=>{
 const i=html.indexOf('function cloudSnapshot('),j=html.indexOf('function missingLifecycleFrom(',i);
 assert.ok(i>0&&j>i);
 const segment=html.slice(i,j);
 assert.doesNotMatch(segment,/coins|game_wallet|purchases|inventory/);
 assert.match(html,/coinWallet=null/);
 assert.match(html,/hq_game_action/);
 assert.match(html,/if\(cloud\.seq!==cloud\.syncedSeq\)/);
 assert.match(html,/coinResultDialog/);
});
test('server wallet only via authenticated restricted RPC with row-level security',()=>{
 for(const name of ['hq_game_wallets','hq_game_rewards','hq_game_inventory','hq_game_draws','hq_game_purchases']){
  assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 }
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/if v_user is null then raise exception/);
 assert.match(sql,/revoke all on function public\.hq_game_action\(text,text\) from public,anon/);
 assert.match(sql,/grant execute on function public\.hq_game_action\(text,text\) to authenticated/);
 assert.match(sql,/for update/);
 assert.match(sql,/primary key\(user_id,game_day\)/);
 assert.match(sql,/primary key\(user_id,reward_type,reward_day\)/);
 assert.doesNotMatch(sql,/update public\.habit_states|delete from public\.habit_states|drop table/);
});
test('yesterday payout is immutable outside following reward day; late sync can top up',()=>{
 assert.match(sql,/elsif v_date=v_yesterday and v_count\*5>v_old then/);
 assert.match(sql,/v_delta:=v_count\*5-v_old/);
 assert.match(sql,/least\(v_count,20\)/);
 assert.match(sql,/v_count\*5/);
 assert.match(sql,/v_earned:=v_earned\+v_amount/);
});
test('gacha duplicates refund fixed coins and do not add a second inventory copy',()=>{
 assert.match(sql,/v_duplicated:=exists/);
 assert.match(sql,/if v_duplicated then\s*update public\.hq_game_wallets set coins=coins\+15/);
 assert.match(sql,/if exists\(select 1 from public\.hq_game_draws/);
 assert.match(sql,/insert into public\.hq_game_inventory/);
});
test('free daily gacha cannot issue real payments or modify XP',()=>{
 assert.doesNotMatch(sql,/stripe|checkout|credit_card|xpStartDate\s*:=/i);
 assert.match(html,/無料ガチャを引く|1日1回 無料で引く/);
 assert.match(html,/XPとは別のゲーム内通貨/);
});

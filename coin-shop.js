/* HABIT QUEST G4: coin shop presentation, not the authority for wallet balances.
 * Only Supabase hq_game_action can award, spend, draw or equip.
 */
(function(root){
 'use strict';
 const ITEMS=Object.freeze([
  {id:'cloak',icon:'🧥',name:'旅人のマント',price:60,rarity:'コモン',chance:35,
   description:'冒険のはじまりを飾る、紫色の旅装。',visual:'旅装のきらめき'},
  {id:'lantern',icon:'🏮',name:'星灯りのランタン',price:100,rarity:'アンコモン',chance:30,
   description:'暗い道にも温かな星明かりが灯る。',visual:'温かな光'},
  {id:'crown',icon:'👑',name:'月光の王冠',price:140,rarity:'レア',chance:20,
   description:'相棒の頭上に輝く、月夜の宝飾。',visual:'王冠の輝き'},
  {id:'aura',icon:'💠',name:'蒼天のオーラ',price:200,rarity:'エピック',chance:10,
   description:'成長した相棒を包む青いオーラ。',visual:'蒼の光彩'},
  {id:'wings',icon:'🪽',name:'天翔ける翼',price:280,rarity:'レジェンド',chance:5,
   description:'長い冒険の憧れ。空色の羽根が舞う。',visual:'天空の羽根'}
 ]);
 const idSet=new Set(ITEMS.map(x=>x.id));
 function normalize(input){
  if(!input||typeof input!=='object')return null;
  if(!Number.isSafeInteger(Number(input.coins))||Number(input.coins)<0)return null;
  const items=Array.isArray(input.items)?[...new Set(input.items.filter(id=>idSet.has(id)))]:[];
  return {coins:Number(input.coins),items,equipped:items.includes(input.equipped)?input.equipped:null,
   gachaUsed:input.gachaUsed===true,gameDay:typeof input.gameDay==='string'?input.gameDay:'',
   yesterday:typeof input.yesterday==='string'?input.yesterday:'',
   yesterdayChecks:Math.max(0,Number(input.yesterdayChecks)||0),
   yesterdayCoins:Math.max(0,Number(input.yesterdayCoins)||0),
   earnedNow:Math.max(0,Number(input.earnedNow)||0),event:input.event||null};
 }
 function gameDayUTC(now){
  // Japan has no DST; shift UTC so 00:00 is the daily 05:40 JST boundary.
  const stamp=Number(now instanceof Date?now.getTime():now);
  return new Date(stamp+(9*60-5*60-40)*60000).toISOString().slice(0,10);
 }
 function itemById(id){return ITEMS.find(x=>x.id===id)||null}
 root.HabitQuestCoinShop=Object.freeze({ITEMS,normalize,gameDayUTC,itemById});
})(typeof window==='undefined'?globalThis:window);

-- HABIT QUEST G4, additive, server-authoritative cosmetic coin economy.
-- No changes to habit_states, auth, Oura, XP, or their RPCs.
-- All mutations are via one auth-bound security-definer RPC. No client write grants.
create table if not exists public.hq_game_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 coins integer not null default 0 check(coins>=0 and coins<=10000000),
 equipped_item text,
 updated_at timestamptz not null default now()
);
create table if not exists public.hq_game_rewards (
 user_id uuid not null references auth.users(id) on delete cascade,
 reward_type text not null check(reward_type in ('login','habits')),
 reward_day date not null,
 coins integer not null check(coins>=0),
 check_count integer not null default 0 check(check_count>=0 and check_count<=20),
 awarded_at timestamptz not null default now(),
 primary key(user_id,reward_type,reward_day)
);
create table if not exists public.hq_game_inventory (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null check(item_id in ('cloak','lantern','crown','aura','wings')),
 source text not null check(source in ('purchase','gacha')),
 acquired_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
create table if not exists public.hq_game_draws (
 user_id uuid not null references auth.users(id) on delete cascade,
 game_day date not null,
 item_id text not null,
 duplicate boolean not null default false,
 refund_coins integer not null default 0 check(refund_coins>=0),
 drawn_at timestamptz not null default now(),
 primary key(user_id,game_day)
);
create table if not exists public.hq_game_purchases (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null,
 price integer not null check(price>0),
 purchased_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
alter table public.hq_game_wallets enable row level security;
alter table public.hq_game_rewards enable row level security;
alter table public.hq_game_inventory enable row level security;
alter table public.hq_game_draws enable row level security;
alter table public.hq_game_purchases enable row level security;
revoke all on public.hq_game_wallets,public.hq_game_rewards,
 public.hq_game_inventory,public.hq_game_draws,public.hq_game_purchases from public,anon,authenticated;
grant select on public.hq_game_wallets,public.hq_game_rewards,
 public.hq_game_inventory,public.hq_game_draws,public.hq_game_purchases to authenticated;
create policy "owner sees own wallet" on public.hq_game_wallets for select to authenticated
 using ((select auth.uid())=user_id);
create policy "owner sees own rewards" on public.hq_game_rewards for select to authenticated
 using ((select auth.uid())=user_id);
create policy "owner sees own inventory" on public.hq_game_inventory for select to authenticated
 using ((select auth.uid())=user_id);
create policy "owner sees own draws" on public.hq_game_draws for select to authenticated
 using ((select auth.uid())=user_id);
create policy "owner sees own purchases" on public.hq_game_purchases for select to authenticated
 using ((select auth.uid())=user_id);

create or replace function public.hq_game_action(p_action text default 'refresh',p_item_id text default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid();
 v_game_day date := ((statement_timestamp() at time zone 'Asia/Tokyo') - interval '5 hours 40 minutes')::date;
 v_yesterday date := ((statement_timestamp() at time zone 'Asia/Tokyo') - interval '5 hours 40 minutes')::date-1;
 v_start date;
 v_last_reward date;
 v_date date;
 v_data jsonb;
 v_count integer;
 v_amount integer;
 v_old integer;
 v_delta integer;
 v_coins integer;
 v_price integer;
 v_item text;
 v_equipped text;
 v_event jsonb := null;
 v_earned integer := 0;
 v_created boolean;
 v_duplicated boolean := false;
 v_roll integer;
 v_items jsonb;
 v_drawn boolean;
 v_yesterday_coins integer;
 v_yesterday_count integer;
begin
 if v_user is null then raise exception 'Login is required' using errcode='28000'; end if;
 if p_action not in ('refresh','buy','draw','equip') or p_action is null then
   raise exception 'Unsupported game action' using errcode='22023';end if;
 if p_action in ('buy','equip') and p_item_id not in ('cloak','lantern','crown','aura','wings') then
   raise exception 'Unknown game item' using errcode='22023';end if;
 insert into public.hq_game_wallets(user_id) values(v_user) on conflict do nothing;
 select coins into v_coins from public.hq_game_wallets where user_id=v_user for update;
 -- One daily login bonus per Japan game day (05:40 boundary).
 v_amount:=null;
 insert into public.hq_game_rewards(user_id,reward_type,reward_day,coins)
 values(v_user,'login',v_game_day,10)
 on conflict do nothing returning coins into v_amount;
 if v_amount is not null then
   update public.hq_game_wallets set coins=coins+v_amount,updated_at=now() where user_id=v_user;
   v_earned:=v_earned+v_amount;
 end if;
 -- Read only canonical cloud checks. Old clients cannot overwrite the wallet.
 select data into v_data from public.habit_states where user_id=v_user;
 if v_data is not null then
   if (v_data->>'xpStartDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
     v_start:=(v_data->>'xpStartDate')::date;
   else
     v_start:=v_game_day;
   end if;
   -- Generously backfill up to 5 years if a user stayed away.
   v_start:=greatest(v_start,v_game_day-1825);
   select max(reward_day) into v_last_reward from public.hq_game_rewards
    where user_id=v_user and reward_type='habits';
   -- Skip historical days that have already been settled. Yesterday can still
   -- receive a positive-only top-up for a late cloud sync that same day.
   if v_last_reward is not null then
     v_start:=greatest(v_start,least(v_last_reward+1,v_yesterday));
   end if;
   for v_date in
     select g::date from generate_series(v_start::timestamp,(v_game_day-1)::timestamp,interval '1 day') g
   loop
     select count(*)::integer into v_count from
       jsonb_each(coalesce(v_data->'checks'->to_char(v_date,'YYYY-MM-DD'),'{}'::jsonb)) c(id,done)
     where c.done='true'::jsonb and exists(
       select 1 from jsonb_array_elements(coalesce(v_data->'habits','[]'::jsonb)) h(obj)
       where h.obj->>'id'=c.id
       and (h.obj->>'createdOn' is null or h.obj->>'createdOn'<=to_char(v_date,'YYYY-MM-DD'))
       and (
         coalesce(jsonb_typeof(h.obj->'activeIntervals'),'null')<>'array'
         or jsonb_array_length(h.obj->'activeIntervals')=0
         or exists (
           select 1 from jsonb_array_elements(h.obj->'activeIntervals') ai(period)
           where (ai.period->>'from' is null or ai.period->>'from'<=to_char(v_date,'YYYY-MM-DD'))
            and (ai.period->>'until' is null or ai.period->>'until'>to_char(v_date,'YYYY-MM-DD'))
         )
       )
     );
     v_count:=least(v_count,20);
     select coins into v_old from public.hq_game_rewards
      where user_id=v_user and reward_type='habits' and reward_day=v_date;
     if not found then
       v_amount:=v_count*5;
       insert into public.hq_game_rewards(user_id,reward_type,reward_day,coins,check_count)
        values(v_user,'habits',v_date,v_amount,v_count);
       if v_amount>0 then
         update public.hq_game_wallets set coins=coins+v_amount,updated_at=now() where user_id=v_user;
         v_earned:=v_earned+v_amount;
       end if;
     elsif v_date=v_yesterday and v_count*5>v_old then
       -- Late cloud sync on payout day can top up yesterday; never debit coins.
       v_delta:=v_count*5-v_old;
       update public.hq_game_rewards set coins=v_count*5,check_count=v_count
        where user_id=v_user and reward_type='habits' and reward_day=v_date;
       update public.hq_game_wallets set coins=coins+v_delta,updated_at=now() where user_id=v_user;
       v_earned:=v_earned+v_delta;
     end if;
   end loop;
 end if;

 if p_action='buy' then
   v_price:=case p_item_id when 'cloak' then 60 when 'lantern' then 100
    when 'crown' then 140 when 'aura' then 200 when 'wings' then 280 else null end;
   if exists(select 1 from public.hq_game_inventory where user_id=v_user and item_id=p_item_id) then
     raise exception 'Item already owned' using errcode='P0001';
   end if;
   select coins into v_coins from public.hq_game_wallets where user_id=v_user;
   if v_coins<v_price then raise exception 'Not enough coins' using errcode='P0001';end if;
   insert into public.hq_game_inventory(user_id,item_id,source) values(v_user,p_item_id,'purchase');
   insert into public.hq_game_purchases(user_id,item_id,price) values(v_user,p_item_id,v_price);
   update public.hq_game_wallets set coins=coins-v_price,updated_at=now() where user_id=v_user;
   v_event:=jsonb_build_object('type','buy','itemId',p_item_id,'price',v_price);
 elsif p_action='draw' then
   if exists(select 1 from public.hq_game_draws where user_id=v_user and game_day=v_game_day) then
     raise exception 'Daily free draw already used' using errcode='P0001';end if;
   v_roll:=floor(random()*100)::integer;
   v_item:=case when v_roll<35 then 'cloak' when v_roll<65 then 'lantern'
    when v_roll<85 then 'crown' when v_roll<95 then 'aura' else 'wings' end;
   v_duplicated:=exists(select 1 from public.hq_game_inventory where user_id=v_user and item_id=v_item);
   insert into public.hq_game_draws(user_id,game_day,item_id,duplicate,refund_coins)
     values(v_user,v_game_day,v_item,v_duplicated,case when v_duplicated then 15 else 0 end);
   if v_duplicated then
     update public.hq_game_wallets set coins=coins+15,updated_at=now() where user_id=v_user;
   else
     insert into public.hq_game_inventory(user_id,item_id,source) values(v_user,v_item,'gacha');
   end if;
   v_event:=jsonb_build_object('type','draw','itemId',v_item,
     'duplicate',v_duplicated,'refund',case when v_duplicated then 15 else 0 end);
 elsif p_action='equip' then
   if not exists(select 1 from public.hq_game_inventory where user_id=v_user and item_id=p_item_id) then
     raise exception 'Item not owned' using errcode='P0001';end if;
   update public.hq_game_wallets set equipped_item=p_item_id,updated_at=now() where user_id=v_user;
   v_event:=jsonb_build_object('type','equip','itemId',p_item_id);
 end if;

 select coins,equipped_item into v_coins,v_equipped from public.hq_game_wallets where user_id=v_user;
 select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) into v_items
   from public.hq_game_inventory where user_id=v_user;
 select exists(select 1 from public.hq_game_draws where user_id=v_user and game_day=v_game_day) into v_drawn;
 select coalesce(coins,0),coalesce(check_count,0) into v_yesterday_coins,v_yesterday_count
   from public.hq_game_rewards where user_id=v_user and reward_type='habits' and reward_day=v_yesterday;
 return jsonb_build_object('coins',v_coins,'items',v_items,'equipped',v_equipped,
   'gameDay',to_char(v_game_day,'YYYY-MM-DD'),'yesterday',to_char(v_yesterday,'YYYY-MM-DD'),
   'yesterdayCoins',coalesce(v_yesterday_coins,0),'yesterdayChecks',coalesce(v_yesterday_count,0),
   'gachaUsed',v_drawn,'earnedNow',v_earned,'event',v_event,
   'nextReset','05:40 JST');
end;
$$;
revoke all on function public.hq_game_action(text,text) from public,anon;
grant execute on function public.hq_game_action(text,text) to authenticated;

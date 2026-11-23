-- APPLIED to Supabase production on 2026-11-23.
-- Purpose: once state has habitSchemaVersion = "2", prevent older apps from
-- overwriting the entire habit_states JSONB via the established save RPC.
-- Existing auth, revision, payload-size, and image protections are preserved.
create or replace function public.save_habit_state(
 p_data jsonb, p_expected_revision bigint default null::bigint
)
returns table(new_revision bigint,is_conflict boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare uid uuid := (select auth.uid()); rev bigint;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>300000 then
   raise exception 'Invalid/oversized state' using errcode='22023';
 end if;
 if (p_data ? 'avatarImages') and p_data->>'avatarImages' like '%data:image%' then
   raise exception 'Base64 images may not be stored in state' using errcode='22023';
 end if;
 if p_expected_revision is null then
   insert into public.habit_states(user_id,data,revision) values(uid,p_data,1)
   on conflict(user_id) do nothing returning revision into rev;
 else
   update public.habit_states set data=p_data,revision=revision+1,updated_at=now()
     where user_id=uid
       and revision=p_expected_revision
       and (
         coalesce(data->>'habitSchemaVersion','') <> '2'
         or p_data->>'habitSchemaVersion' = '2'
       )
     returning revision into rev;
 end if;
 return query select rev,rev is null;
end
$function$;

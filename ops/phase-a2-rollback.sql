-- EMERGENCY USE ONLY. NOT EXECUTED.
-- Requires authenticated database operator. Reversion removes the protection
-- against old client overwrites; never run while v2 user data is exposed to
-- still-open older tabs. Keep private backups available.
-- Production backup: hq_private.phase_a2_predeploy_backup
-- backup_tag = 2026-11-23-phase-a2-before-rpc.
do $restore$
declare original_definition text;
begin
 select original_rpc_ddl into original_definition
 from hq_private.phase_a2_predeploy_backup
 where backup_tag='2026-11-23-phase-a2-before-rpc'
 order by created_at
 limit 1;
 if original_definition is null then
   raise exception 'No predeployment RPC backup found; abort rollback';
 end if;
 execute original_definition;
end
$restore$;
-- Only reverts the RPC function. It deliberately does NOT overwrite
-- habit_states rows or reset first-login dates / checks / XP.

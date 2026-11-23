-- HABIT QUEST - first-login XP start is a per-user, immutable date (Asia/Tokyo).
-- Run through Supabase SQL migrations. Existing user-specific dates should be
-- backfilled by an explicit, separately reviewed data migration.
-- First authenticated app launch sets xpStartDate in habit_states.data; once
-- stored, all subsequent writes preserve that date even if an old/offline
-- client or a JSON backup attempts to overwrite it.

CREATE OR REPLACE FUNCTION public.hq_preserve_xp_start_date()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
DECLARE
  today_jst text := pg_catalog.to_char(pg_catalog.timezone('Asia/Tokyo',pg_catalog.now()),'YYYY-MM-DD');
  chosen text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.data ? 'xpStartDate'
     AND OLD.data->>'xpStartDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    chosen := OLD.data->>'xpStartDate';
  ELSE
    chosen := NEW.data->>'xpStartDate';
    IF chosen IS NULL OR chosen !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR chosen > today_jst THEN
      chosen := today_jst;
    END IF;
  END IF;
  NEW.data := pg_catalog.jsonb_set(
    coalesce(NEW.data,'{}'::jsonb),
    '{xpStartDate}',pg_catalog.to_jsonb(chosen),true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hq_fix_xp_start_date ON public.habit_states;
CREATE TRIGGER hq_fix_xp_start_date
BEFORE INSERT OR UPDATE OF data ON public.habit_states
FOR EACH ROW EXECUTE FUNCTION public.hq_preserve_xp_start_date();

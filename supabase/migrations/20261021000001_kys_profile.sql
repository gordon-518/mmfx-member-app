-- ============================================================================
-- Know Your Style goes native (Gordon, 21 Oct).
--
-- KYS used to run as an iframed app on its own Vercel project, and the member
-- app only learned the archetype if the member clicked "Send me a copy" —
-- /api/kys/send-copy was the single writer of kys_archetype. Anyone who
-- finished the assessment without emailing it stayed anonymous to the app, so
-- the dashboard, the welcome checklist and the upgrade plan finder all fell
-- back to generic copy for them.
--
-- Native KYS saves the whole result when it is generated: the archetype, the
-- six dimension scores, and the written report. One row per member on
-- profiles — a retake overwrites it, which is what "your current profile"
-- means. kys_completed_at keeps its FIRST value so activation timing stays
-- comparable; kys_updated_at tracks the latest take.
--
-- Additive: three nullable columns and one own-row RPC.
-- ============================================================================

alter table public.profiles
  add column if not exists kys_dimensions jsonb,
  add column if not exists kys_report     text,
  add column if not exists kys_updated_at timestamptz;

comment on column public.profiles.kys_dimensions is
  'Know Your Style: the six 0-100 dimension scores, e.g. {"risk_discipline":42,...}. Written only by fn_save_kys_result.';
comment on column public.profiles.kys_report is
  'Know Your Style: the markdown report the member was shown, so it can be re-read and emailed later.';
comment on column public.profiles.kys_updated_at is
  'Know Your Style: when the profile was last taken. kys_completed_at keeps the FIRST completion.';

-- The six dimensions, as the app scores them. Kept here so a malformed or
-- renamed key can never silently land in the column.
create or replace function public.fn_save_kys_result(
  p_archetype  text,
  p_dimensions jsonb,
  p_report     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  dims constant text[] := array[
    'risk_discipline', 'emotional_control', 'independent_conviction',
    'decisiveness', 'consistency', 'process_routine'
  ];
  d    text;
  v    jsonb;
begin
  if uid is null then
    raise exception 'fn_save_kys_result: no authenticated user';
  end if;

  if p_archetype is null or p_archetype !~ '^[a-z_]{3,40}$' then
    raise exception 'fn_save_kys_result: archetype looks wrong';
  end if;

  if p_dimensions is null or jsonb_typeof(p_dimensions) <> 'object' then
    raise exception 'fn_save_kys_result: dimensions must be a JSON object';
  end if;

  -- Every dimension present, numeric, and in range. The UI renders these as
  -- bars, so a stray string or a 900 would render as a broken profile.
  foreach d in array dims loop
    v := p_dimensions -> d;
    if v is null or jsonb_typeof(v) <> 'number' then
      raise exception 'fn_save_kys_result: dimension % missing or not a number', d;
    end if;
    if (v::numeric) < 0 or (v::numeric) > 100 then
      raise exception 'fn_save_kys_result: dimension % out of range', d;
    end if;
  end loop;

  if (select count(*) from jsonb_object_keys(p_dimensions)) <> array_length(dims, 1) then
    raise exception 'fn_save_kys_result: unexpected dimension keys';
  end if;

  -- The report is shown back to the member; a runaway value would bloat the
  -- row and every profile read with it.
  if p_report is not null and length(p_report) > 20000 then
    raise exception 'fn_save_kys_result: report too long';
  end if;

  update public.profiles p
     set kys_archetype   = p_archetype,
         kys_dimensions  = p_dimensions,
         kys_report      = p_report,
         kys_updated_at  = now(),
         -- First completion wins: activation timing stays comparable.
         kys_completed_at = coalesce(p.kys_completed_at, now())
   where p.id = uid;
end;
$$;

revoke all on function public.fn_save_kys_result(text, jsonb, text) from public, anon;
grant execute on function public.fn_save_kys_result(text, jsonb, text) to authenticated;

-- ============================================================================
-- Security-review hardening: set_updated_at least-privilege + search_path pin.
--
-- set_updated_at is a trigger function — PostgREST cannot invoke trigger-
-- returning functions, so this was never exploitable. But it was the only
-- function in the project without a search_path pin and without the
-- default PUBLIC execute revoked. Bring it in line with the others.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

-- Belt-and-braces: re-assert the admin-function privileges on the live DB
-- (they were inherited through create-or-replace; make them explicit).
revoke execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) from public;
grant  execute on function public.fn_verify_deposit(uuid, text, numeric, boolean) to authenticated;

-- Explicit table grant so the schema is self-contained when
-- auto_expose_new_tables = false (now pinned in config.toml). RLS remains
-- the row gate; this is the table-level prerequisite. anon gets nothing.
grant select on table public.profiles to authenticated;

-- ============================================================================
-- Sponsor brokers — admit gtc and weby (sponsor dashboard, follow-up 5 Nov 2026).
--
-- Gordon's sponsors: Octa for Malaysia, GTC for Singapore, Weby for Indonesia.
-- GTC and Weby are not yet partnered brokers in the app — upgrade routing,
-- deposit verification and the ledger still know octa, dupoin and elev8 — so a
-- GTC or Weby dashboard counts signups, activation and upgrade visits today and
-- will count broker clicks, submissions and funding once the app records
-- deposits under those broker ids. Widening the SPONSOR list here is what lets
-- the two dashboards exist now; making GTC and Weby funnel brokers is separate.
--
-- Additive: one check constraint widened; fn_sponsor_set re-created with the
-- same body and the wider list. profiles.broker and deposit_events.broker are
-- untouched.
-- ============================================================================
alter table public.partners
  drop constraint if exists partners_brokers_check;
alter table public.partners
  add constraint partners_brokers_check check (
    brokers is null or brokers <@ array['octa', 'dupoin', 'elev8', 'gtc', 'weby']::text[]
  );

comment on column public.partners.brokers is
  'For sponsors: the broker ids that count as funded with the sponsor. octa/dupoin/elev8 are funnel brokers; gtc/weby are sponsors whose funnel counts stay at zero until the app records deposits under them.';

create or replace function public.fn_sponsor_set(p_slug text, p_brokers text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug    text := lower(btrim(coalesce(p_slug, '')));
  v_brokers text[];
begin
  if v_slug !~ '^[a-z0-9]{2,24}$' then
    raise exception 'fn_sponsor_set: slug % must match ^[a-z0-9]{2,24}$', p_slug;
  end if;

  select coalesce(array_agg(x order by x), '{}'::text[])
    into v_brokers
    from (select distinct lower(btrim(b)) as x
            from unnest(coalesce(p_brokers, '{}'::text[])) as b
           where btrim(b) <> '') s;

  if coalesce(array_length(v_brokers, 1), 0) = 0 then
    raise exception 'fn_sponsor_set: a sponsor needs at least one broker';
  end if;
  if not (v_brokers <@ array['octa', 'dupoin', 'elev8', 'gtc', 'weby']::text[]) then
    raise exception 'fn_sponsor_set: brokers % must be among octa, dupoin, elev8, gtc, weby', v_brokers;
  end if;

  update public.partners
     set kind = 'sponsor', brokers = v_brokers
   where slug = v_slug;
  if not found then
    raise exception 'fn_sponsor_set: no partner %. Mint it first with fn_partner_create.', v_slug;
  end if;
end;
$$;

revoke all on function public.fn_sponsor_set(text, text[]) from public, anon, authenticated;
grant execute on function public.fn_sponsor_set(text, text[]) to service_role;

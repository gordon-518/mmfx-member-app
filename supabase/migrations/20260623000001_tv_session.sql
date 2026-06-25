-- ============================================================================
-- Persisted TradingView session (single row).
-- The TV access automation logs into TradingView to mint a session cookie.
-- Logging in on every serverless cold start triggers TradingView's bot
-- detection (reCAPTCHA) from datacenter IPs. Storing ONE session here, shared
-- across all instances, means we authenticate ~once a month instead of
-- constantly — keeping us under the CAPTCHA radar. An admin can also paste a
-- fresh cookie here (from a real browser, no CAPTCHA) as the manual fallback.
--
-- RLS is enabled with NO policies: anon and authenticated roles get zero
-- access. Only the service role (used by the server-only TV client) can
-- read/write, bypassing RLS. The session cookie never reaches a browser.
-- ============================================================================

create table if not exists public.tv_session (
  id             smallint primary key default 1,
  sessionid      text not null,
  sessionid_sign text not null,
  updated_at     timestamptz not null default now(),
  constraint tv_session_singleton check (id = 1)
);

alter table public.tv_session enable row level security;

revoke all on public.tv_session from anon, authenticated;

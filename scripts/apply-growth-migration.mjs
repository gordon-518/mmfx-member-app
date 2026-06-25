// One-off: apply the growth_daily table + RLS + extensions to the live DB via
// the IPv4 pooler (direct host is IPv6-only). Does NOT schedule the pg_cron job
// — that needs CRON_SECRET and is applied out-of-band. Idempotent.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const direct = new URL(env.DATABASE_URL);
const password = decodeURIComponent(direct.password);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const SQL = `
create table if not exists public.growth_daily (
  date                 date primary key,
  signups_today        integer not null default 0,
  signups_7d           integer not null default 0,
  signups_30d          integer not null default 0,
  trials_active        integer not null default 0,
  trials_expiring_48h  integer not null default 0,
  conversions_today    integer not null default 0,
  members_active       integer not null default 0,
  churn_today          integer not null default 0,
  tv_engagement_pct    numeric not null default 0,
  broker_split         jsonb   not null default '{}'::jsonb,
  narrative            text,
  created_at           timestamptz not null default now()
);

comment on table public.growth_daily is
  'Daily business-growth snapshot (aggregate counts only, no PII). Written by the daily-stats cron at 09:00 SGT; read by the admin growth dashboard.';

alter table public.growth_daily enable row level security;

revoke all on public.growth_daily from anon, authenticated;
grant select on public.growth_daily to authenticated;

drop policy if exists "growth_daily_select_admin" on public.growth_daily;
create policy "growth_daily_select_admin"
  on public.growth_daily
  for select
  to authenticated
  using ( public.is_admin() );

create extension if not exists pg_cron;
create extension if not exists pg_net;
`;

try {
  await client.connect();
  await client.query(SQL);
  const r = await client.query(
    "select count(*) as n from information_schema.tables where table_name = 'growth_daily'"
  );
  console.log("growth_daily present:", r.rows[0].n === "1");
  const ext = await client.query(
    "select extname from pg_extension where extname in ('pg_cron','pg_net') order by extname"
  );
  console.log("extensions:", ext.rows.map((x) => x.extname).join(", ") || "(none)");
  console.log("OK — migration applied");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

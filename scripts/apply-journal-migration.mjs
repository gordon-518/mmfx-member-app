// One-off: apply the AI Trading Journal core schema to the live DB via the
// IPv4 pooler (direct host is IPv6-only). Reads the migration file itself so
// SQL is never duplicated. Does NOT schedule the pg_cron job — that needs
// CRON_SECRET and is applied out-of-band (snippet in the migration comment).
// Idempotent: `create table if not exists` + drop/recreate policies.
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

const sql = readFileSync(
  new URL("../supabase/migrations/20260706000001_journal_core.sql", import.meta.url),
  "utf8"
);

// Policies aren't `if not exists`-able on this PG major — drop first so the
// script is re-runnable.
const DROP_POLICIES = `
drop policy if exists "journal_accounts_select_own" on public.journal_accounts;
drop policy if exists "journal_accounts_insert_own" on public.journal_accounts;
drop policy if exists "journal_accounts_update_own" on public.journal_accounts;
drop policy if exists "journal_deals_select_own" on public.journal_deals;
drop policy if exists "journal_trades_select_own" on public.journal_trades;
drop policy if exists "journal_trades_update_own" on public.journal_trades;
drop policy if exists "journal_cash_flows_select_own" on public.journal_cash_flows;
drop policy if exists "journal_goals_all_own" on public.journal_goals;
`;

const PRE = `
do $\$ begin
  if to_regclass('public.journal_accounts') is not null then
    execute '${DROP_POLICIES.replaceAll("'", "''").trim().split("\n").join(" ")}';
  end if;
end $\$;
`;

try {
  await client.connect();
  await client.query("begin");
  await client.query(PRE);
  await client.query(sql);
  await client.query("commit");
  console.log("journal_core migration applied ✔");
  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name like 'journal_%' order by 1`
  );
  console.log("tables:", rows.map((r) => r.table_name).join(", "));
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

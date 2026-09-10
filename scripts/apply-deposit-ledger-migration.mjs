// One-off: apply 20260910000005_deposit_ledger.sql (conversion-fix 3.1) via the
// IPv4 pooler, then check the plan's "done when": backfill rows = verified
// members, sum(ledger) = deposit_amount for every one of them, grandfathered =
// the 112 legacy members, and the ledger is admin-read-only. Idempotency is
// checked by applying the file a second time and confirming nothing changed.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000005_deposit_ledger.sql", import.meta.url), "utf8"
);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

let failed = false;
const ok = (label, cond, detail = "") => {
  if (!cond) failed = true;
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};
const n = async (sql, params = []) => (await client.query(sql, params)).rows[0].n;

try {
  await client.connect();
  const verified = await n("select count(*)::int n from public.profiles where deposit_verified_at is not null");
  const legacy = await n("select count(*)::int n from public.profiles where account_status = 'member_active' and deposit_verified_at is null");
  console.log(`before: ${verified} verified members, ${legacy} legacy\n`);

  for (const pass of [1, 2]) {
    await client.query("begin");
    await client.query(SQL);
    await client.query("commit");
    console.log(`applied (pass ${pass})`);
  }

  ok("one ledger row per verified member (idempotent across 2 passes)",
    (await n("select count(*)::int n from public.deposit_events")) === verified, `(${verified})`);
  ok("sum(ledger) = deposit_amount for every verified member",
    (await n(`select count(*)::int n from public.profiles p
               where p.deposit_verified_at is not null
                 and p.deposit_amount is distinct from
                     (select sum(e.amount) from public.deposit_events e where e.user_id = p.id)`)) === 0);
  ok("grandfathered = legacy count",
    (await n("select count(*)::int n from public.profiles where grandfathered")) === legacy, `(${legacy})`);
  ok("no verified member is grandfathered",
    (await n("select count(*)::int n from public.profiles where grandfathered and deposit_verified_at is not null")) === 0);

  const g = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'deposit_events'`
  )).rows[0].g;
  ok("anon has no grant on deposit_events", !g.includes("anon"), `[${g.join(", ")}]`);

  // A non-admin member must read nothing (rolled back).
  const member = (await client.query(
    "select id from public.profiles where deposit_verified_at is not null and not coalesce(is_admin,false) limit 1"
  )).rows[0].id;
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: member, role: "authenticated" })]);
    ok("a member can't read the ledger (even their own row)",
      (await n("select count(*)::int n from public.deposit_events")) === 0);
    let insertBlocked = false;
    try {
      await client.query("insert into public.deposit_events (user_id, amount, broker, ib_confirmed) values ($1, 1, 'octa', true)", [member]);
    } catch { insertBlocked = true; }
    ok("a member can't write the ledger", insertBlocked);
  } finally {
    await client.query("rollback");
  }

  console.log(failed ? "\nFAILED — see above" : "\nOK — migration applied and verified");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

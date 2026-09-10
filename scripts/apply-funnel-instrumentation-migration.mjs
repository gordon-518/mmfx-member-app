// One-off: apply 20260910000002_funnel_instrumentation.sql (conversion-fix
// Phase 1) to the live DB via the IPv4 pooler (the direct host is IPv6-only).
// Additive + idempotent. Reads the migration file itself so the SQL can't drift
// from what's committed, then verifies every object and grant it should create.
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

const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000002_funnel_instrumentation.sql", import.meta.url),
  "utf8"
);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

// Expected EXECUTE grantees per function. postgres = owner; service_role gets
// EXECUTE from Supabase's default privileges on every new public function (it
// bypasses RLS anyway). What matters is that anon/PUBLIC never appear, and
// that authenticated appears only where a browser session should call it.
const EXPECT = {
  fn_app_event_insert: ["postgres", "service_role"],
  fn_log_event: ["authenticated", "postgres", "service_role"],
  fn_log_event_as: ["postgres", "service_role"],
  fn_set_signup_attribution: ["authenticated", "postgres", "service_role"],
  fn_admin_funnel_stats: ["authenticated", "postgres", "service_role"],
};

let failed = false;
try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");

  const t = await client.query(
    "select count(*)::int n from information_schema.tables where table_schema='public' and table_name='app_events'"
  );
  const col = await client.query(
    "select count(*)::int n from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='tv_connected_at'"
  );
  console.log("app_events table:", t.rows[0].n === 1 ? "ok" : "MISSING");
  console.log("profiles.tv_connected_at:", col.rows[0].n === 1 ? "ok" : "MISSING");
  if (t.rows[0].n !== 1 || col.rows[0].n !== 1) failed = true;

  for (const [fn, want] of Object.entries(EXPECT)) {
    const g = await client.query(
      `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
         from information_schema.routine_privileges
        where routine_schema='public' and routine_name=$1 and privilege_type='EXECUTE'`,
      [fn]
    );
    const got = g.rows[0].g;
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed = true;
    console.log(`${fn}: ${ok ? "ok" : "GRANT MISMATCH"}  [${got.join(", ")}]`);
  }

  // The two re-created functions must keep their existing grants.
  for (const fn of ["fn_resolve_trial_status", "fn_set_tradingview_username"]) {
    const g = await client.query(
      `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
         from information_schema.routine_privileges
        where routine_schema='public' and routine_name=$1 and privilege_type='EXECUTE'`,
      [fn]
    );
    const got = g.rows[0].g;
    const ok = got.includes("authenticated") && !got.includes("anon") && !got.includes("PUBLIC");
    if (!ok) failed = true;
    console.log(`${fn}: ${ok ? "grants preserved" : "GRANT CHANGED"}  [${got.join(", ")}]`);
  }

  console.log(failed ? "FAILED — see above" : "OK — migration applied and verified");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

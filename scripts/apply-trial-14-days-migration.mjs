// One-off: apply 20260910000003_trial_14_days.sql (conversion-fix 2.1a) via the
// IPv4 pooler, then prove it: each live body must now be the committed body,
// and a signup inside a ROLLED-BACK transaction must get a 14-day clock with
// its fingerprint captured. (pg_net requests queue transactionally, so the
// SendPulse insert trigger sends nothing when the test rolls back.)
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000003_trial_14_days.sql", import.meta.url), "utf8"
);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

let failed = false;
const ok = (label, cond, detail = "") => { if (!cond) failed = true; console.log(`${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`); };

try {
  await client.connect();
  const before = (await client.query(
    "select count(*)::int n from public.profiles where account_status in ('trial_active','re_trial_active')"
  )).rows[0].n;

  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");

  for (const fn of ["handle_new_user", "fn_grant_retrial", "fn_admin_update_member"]) {
    const def = (await client.query(
      "select pg_get_functiondef(oid) d from pg_proc where pronamespace='public'::regnamespace and proname=$1", [fn]
    )).rows[0].d.trim();
    ok(`${fn}: live body == committed body`, SQL.includes(def));
    ok(`${fn}: no 7-day interval left`, !/interval '7 days'/.test(def));
  }
  const fp = (await client.query(
    "select pg_get_functiondef('public.handle_new_user'::regproc) d"
  )).rows[0].d;
  ok("handle_new_user still captures signup_fingerprint", fp.includes("signup_fingerprint"));

  // Rolled-back signup through the real trigger.
  await client.query("begin");
  try {
    const id = (await client.query("select gen_random_uuid() id")).rows[0].id;
    await client.query(
      `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
               $2, '{"full_name":"Smoke Test","fingerprint":"fp-smoke"}'::jsonb, now(), now())`,
      [id, `smoke-${id.slice(0, 8)}@example.invalid`]
    );
    const p = (await client.query(
      `select extract(epoch from trial_ends_at - signup_at) / 86400 as days, signup_fingerprint, account_status
         from public.profiles where id = $1`, [id]
    )).rows[0];
    ok("test signup gets a 14-day clock", Number(p.days) === 14, `(${p.days} days)`);
    ok("test signup fingerprint captured", p.signup_fingerprint === "fp-smoke");
    ok("test signup is trial_active", p.account_status === "trial_active");
  } finally {
    await client.query("rollback");
  }

  const after = (await client.query(
    "select count(*)::int n from public.profiles where account_status in ('trial_active','re_trial_active')"
  )).rows[0].n;
  ok("running trials untouched (no backfill)", after === before, `(${before} -> ${after})`);

  console.log(failed ? "FAILED — see above" : "OK — migration applied and verified (test signup rolled back)");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

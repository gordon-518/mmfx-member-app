// One-off: apply 20260915000004_trial_fairness.sql via the IPv4 pooler, then
// prove it as a real admin inside a ROLLED-BACK transaction: a running trial's
// clock survives a $50 verify; an expired trial's clock is still cleared.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000004_trial_fairness.sql", import.meta.url), "utf8");
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

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const g = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'fn_verify_deposit' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("grants unchanged (no anon/PUBLIC)", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);

  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;
  const live = (await client.query(
    `select id, trial_ends_at from public.profiles where account_status = 'trial_active' and trial_ends_at > now() + interval '2 days'
       and not coalesce(is_admin,false) order by signup_at desc limit 1`
  )).rows[0];
  const expired = (await client.query(
    `select id from public.profiles where account_status = 'trial_expired' and not coalesce(is_admin,false) order by signup_at desc limit 1`
  )).rows[0];

  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: admin, role: "authenticated" })]);
    const a = (await client.query("select account_status, deposit_amount, trial_ends_at from public.fn_verify_deposit($1, 'octa', 50, true)", [live.id])).rows[0];
    ok("a running trial's $50 verify -> member_active at $50",
      a.account_status === "member_active" && Number(a.deposit_amount) === 50);
    ok("... and the trial clock is kept",
      a.trial_ends_at && new Date(a.trial_ends_at).getTime() === new Date(live.trial_ends_at).getTime(), `(${a.trial_ends_at})`);
    const b = (await client.query("select account_status, trial_ends_at from public.fn_verify_deposit($1, 'octa', 50, true)", [expired.id])).rows[0];
    ok("an expired trial's verify still clears the clock", b.account_status === "member_active" && b.trial_ends_at === null);
  } finally {
    await client.query("rollback");
  }

  console.log(failed ? "\nFAILED — see above" : "\nOK — migration applied and verified (scenario rolled back)");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

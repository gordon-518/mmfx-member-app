// One-off: apply 20260910000006_verify_deposit_tiers.sql (conversion-fix 3.2)
// via the IPv4 pooler, then prove the new rules as a real admin inside a
// ROLLED-BACK transaction: <$50 refused, $50 first deposit -> member at
// Foundation, $150 top-up -> Desk, two ledger rows, cumulative total, and the
// first verification time unchanged by the top-up.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000006_verify_deposit_tiers.sql", import.meta.url), "utf8"
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

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const g = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = $1 and privilege_type = 'EXECUTE'`, ["fn_verify_deposit"]
  )).rows[0].g;
  ok("fn_verify_deposit grants unchanged (no anon/PUBLIC)", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);
  const ig = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'fn_app_event_insert' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("fn_app_event_insert still unreachable by clients", !ig.includes("authenticated") && !ig.includes("anon"), `[${ig.join(", ")}]`);

  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;
  const trial = (await client.query(
    `select id from public.profiles where account_status = 'trial_active' and trial_ends_at > now()
       and deposit_verified_at is null and not coalesce(is_admin,false) order by signup_at desc limit 1`
  )).rows[0].id;

  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: admin, role: "authenticated" })]);
    const verify = (amt) => client.query("select * from public.fn_verify_deposit($1, 'octa', $2, true)", [trial, amt]);

    await client.query("savepoint s");
    let refused = false;
    try { await verify(49.99); } catch (e) { refused = /below \$50/.test(e.message); }
    await client.query("rollback to savepoint s");
    ok("$49.99 refused", refused);

    const first = (await verify(50)).rows[0];
    ok("$50 first deposit -> member_active, $50 cumulative",
      first.account_status === "member_active" && Number(first.deposit_amount) === 50, `(${first.account_status}, $${first.deposit_amount})`);
    const firstAt = first.deposit_verified_at;

    const top = (await verify(150)).rows[0];
    ok("$150 top-up accepted for an existing member -> $200 cumulative (Desk)", Number(top.deposit_amount) === 200, `($${top.deposit_amount})`);
    ok("top-up keeps the first verification time",
      new Date(top.deposit_verified_at).getTime() === new Date(firstAt).getTime());

    const led = (await client.query("select count(*)::int n, sum(amount)::numeric s, bool_and(verified_by = $2) by_admin from public.deposit_events where user_id = $1", [trial, admin])).rows[0];
    ok("two ledger rows summing to $200, verified_by = the admin",
      led.n === 2 && Number(led.s) === 200 && led.by_admin === true, `(${led.n} rows, $${led.s})`);

    await client.query("reset role");
    await client.query("savepoint e");
    let evOk = true;
    try { await client.query("select public.fn_app_event_insert($1, 'tier_changed', '{\"from\":\"foundation\",\"to\":\"desk\"}')", [trial]); }
    catch { evOk = false; }
    await client.query("rollback to savepoint e");
    ok("tier_changed is on the event allowlist", evOk);
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

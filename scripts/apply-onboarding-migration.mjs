// One-off: apply 20260910000007_onboarding.sql (conversion-fix Phase 4) via the
// IPv4 pooler, then prove it as the real roles inside a ROLLED-BACK
// transaction: the checklist read, the lesson-1 event (logged once, deduped),
// unknown steps refused, and anon shut out.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260910000007_onboarding.sql", import.meta.url), "utf8");
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
const grants = async (fn) => (await client.query(
  `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
     from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = $1 and privilege_type = 'EXECUTE'`, [fn]
)).rows[0].g;

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  for (const [fn, wantAuth] of [["fn_my_onboarding", true], ["fn_log_event", true], ["fn_app_event_insert", false]]) {
    const g = await grants(fn);
    ok(`${fn}: ${wantAuth ? "authenticated only" : "no client role"}`,
      g.includes("authenticated") === wantAuth && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);
  }

  // A recent trial with no TradingView username and no KYS, so steps start open.
  const user = (await client.query(
    `select id from public.profiles where account_status = 'trial_active' and tradingview_username is null
       and kys_completed_at is null and not coalesce(is_admin,false) order by signup_at desc limit 1`
  )).rows[0].id;

  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
    const read = async () => (await client.query("select public.fn_my_onboarding() s")).rows[0].s;

    const before = await read();
    ok("checklist has the five steps", ["tv", "analysis", "kys", "lesson1", "desk"].every((k) => typeof before[k] === "boolean"), JSON.stringify(before));
    ok("tv and kys start open for this user", before.tv === false && before.kys === false);

    await client.query("select public.fn_log_event('onboarding_step_done', '{\"step\":\"lesson-1\"}')");
    await client.query("select public.fn_log_event('onboarding_step_done', '{\"step\":\"lesson-1\"}')");
    ok("lesson 1 marked by the client shows as done", (await read()).lesson1 === true);

    await client.query("savepoint s");
    let refused = false;
    try { await client.query("select public.fn_log_event('onboarding_step_done', '{\"step\":\"kys\"}')"); }
    catch (e) { refused = /unknown onboarding step/.test(e.message); }
    await client.query("rollback to savepoint s");
    ok("a client can't invent other steps", refused);

    await client.query("reset role");
    const n = (await client.query(
      "select count(*)::int n from public.app_events where user_id = $1 and event = 'onboarding_step_done'", [user]
    )).rows[0].n;
    ok("logged once despite two calls (deduped)", n === 1, `(${n})`);

    await client.query("set local role anon");
    await client.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    await client.query("savepoint a");
    let anonDenied = false;
    try { await client.query("select public.fn_my_onboarding()"); } catch { anonDenied = true; }
    await client.query("rollback to savepoint a");
    ok("anon can't read a checklist", anonDenied);
  } finally {
    await client.query("rollback");
  }

  console.log(failed ? "\nFAILED — see above" : "\nOK — migration applied and verified (checks rolled back)");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

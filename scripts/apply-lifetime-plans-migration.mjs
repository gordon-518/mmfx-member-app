// One-off: apply 20260915000003_lifetime_plans.sql (conversion-fix Phase 6)
// via the IPv4 pooler, then prove the grant as the real roles inside a
// ROLLED-BACK transaction.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000003_lifetime_plans.sql", import.meta.url), "utf8");
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
const as = async (role, uid) => {
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role } : { role })]);
};
const tries = async (sql, params = []) => {
  await client.query("savepoint t");
  try { const r = await client.query(sql, params); await client.query("release savepoint t"); return r; }
  catch (e) { await client.query("rollback to savepoint t"); return e.message; }
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
      where routine_schema = 'public' and routine_name = 'fn_admin_grant_lifetime' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("grants: authenticated, never anon/PUBLIC", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);

  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;
  const user = (await client.query(
    `select id from public.profiles where account_status in ('trial_active','trial_expired')
       and trading_account_number is null and not coalesce(is_admin,false) order by signup_at desc limit 1`
  )).rows[0].id;

  await client.query("begin");
  try {
    await as("authenticated", user);
    ok("a non-admin can't grant", /not an admin/.test(await tries("select public.fn_admin_grant_lifetime($1, 'team')", [user])));
    await client.query("reset role");

    await as("authenticated", admin);
    ok("an unknown plan is refused", /Choose a lifetime plan/.test(await tries("select public.fn_admin_grant_lifetime($1, 'gold')", [user])));
    const t = await tries("select account_status, lifetime_plan, trial_ends_at, trading_account_number from public.fn_admin_grant_lifetime($1, 'team')", [user]);
    ok("grant Team MM Access -> member_active, plan team, no trial clock, no account number needed",
      typeof t !== "string" && t.rows[0].account_status === "member_active" && t.rows[0].lifetime_plan === "team"
        && t.rows[0].trial_ends_at === null && t.rows[0].trading_account_number === null,
      typeof t === "string" ? t : JSON.stringify(t.rows[0]));
    const up = await tries("select lifetime_plan from public.fn_admin_grant_lifetime($1, 'team_mentorship')", [user]);
    ok("upgrade to Team MM + Mentorship", typeof up !== "string" && up.rows[0].lifetime_plan === "team_mentorship");
    ok("Mentorship can't be downgraded to Team only", /already has Team MM \+ Mentorship/.test(await tries("select public.fn_admin_grant_lifetime($1, 'team')", [user])));
    await client.query("reset role");

    await as("authenticated", user);
    ok("the member still can't write the plan directly",
      typeof (await tries("update public.profiles set lifetime_plan = 'team' where id = $1", [user])) === "string"
      || (await client.query("select lifetime_plan from public.profiles where id = $1", [user])).rows[0].lifetime_plan === "team_mentorship");
    await client.query("reset role");
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

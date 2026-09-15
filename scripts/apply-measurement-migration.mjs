// One-off: apply 20260915000001_measurement.sql (conversion-fix Phase 7) via
// the IPv4 pooler, then prove it as the real roles inside a ROLLED-BACK
// transaction and print the aggregate the admin sees (counts only).
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000001_measurement.sql", import.meta.url), "utf8");
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

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const g = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'fn_admin_measurement' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("grants: authenticated, never anon/PUBLIC", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);

  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;
  const user = (await client.query("select id from public.profiles where not coalesce(is_admin,false) order by signup_at desc limit 1")).rows[0].id;

  await client.query("begin");
  try {
    await as("authenticated", admin);
    const m = (await client.query("select public.fn_admin_measurement() m")).rows[0].m;
    ok("admin gets all four views", ["tier_cohorts", "analysis_split", "trial_cohorts", "weekly"].every((k) => k in m));
    console.log("\n" + JSON.stringify(m, null, 2) + "\n");
    await client.query("reset role");

    await as("authenticated", user);
    await client.query("savepoint s");
    let denied = false;
    try { await client.query("select public.fn_admin_measurement()"); } catch (e) { denied = /admins only/.test(e.message); }
    await client.query("rollback to savepoint s");
    ok("a non-admin is refused", denied);
    await client.query("reset role");

    await as("anon", null);
    await client.query("savepoint a");
    let anonDenied = false;
    try { await client.query("select public.fn_admin_measurement()"); } catch { anonDenied = true; }
    await client.query("rollback to savepoint a");
    ok("anon is refused", anonDenied);
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

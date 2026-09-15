// One-off: apply 20260915000002_onboarding_batch.sql (conversion-fix 4.3
// follow-up) via the IPv4 pooler, then prove it's service-role only and that
// it agrees with fn_my_onboarding for a sample user. Prints counts only.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000002_onboarding_batch.sql", import.meta.url), "utf8");
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
      where routine_schema = 'public' and routine_name = 'fn_onboarding_states' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("service_role only (no authenticated/anon/PUBLIC)",
    g.includes("service_role") && !g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);

  const profiles = (await client.query("select count(*)::int n from public.profiles")).rows[0].n;
  const rows = (await client.query("select * from public.fn_onboarding_states()")).rows;
  ok("one row per profile", rows.length === profiles, `(${rows.length})`);
  const dist = {};
  for (const r of rows) dist[r.done] = (dist[r.done] ?? 0) + 1;
  console.log("      steps done -> users:", JSON.stringify(dist));

  // Agreement with the per-user checklist, for a user with some progress.
  const sample = rows.find((r) => r.done >= 2) ?? rows[0];
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: sample.user_id, role: "authenticated" })]);
    const mine = (await client.query("select public.fn_my_onboarding() s")).rows[0].s;
    const fromMine = ["tv", "analysis", "kys", "lesson1", "desk"].filter((k) => mine[k]).join(",");
    ok("matches fn_my_onboarding for a sample user", fromMine === sample.steps, `(${sample.steps || "none"})`);

    await client.query("savepoint s");
    let denied = false;
    try { await client.query("select * from public.fn_onboarding_states()"); } catch { denied = true; }
    await client.query("rollback to savepoint s");
    ok("a signed-in user can't call it", denied);
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

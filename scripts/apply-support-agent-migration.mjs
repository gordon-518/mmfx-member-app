// One-off: apply 20260915000010_support_agent.sql via the IPv4 pooler, then prove
// the tables, the seed row, RLS (anon and a non-admin see nothing) and the purge job.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260915000010_support_agent.sql", import.meta.url), "utf8"
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

  const s = (await client.query("select enabled, bonus_code, bonus_code_expires::text d from public.support_settings where id = 1")).rows[0];
  ok("seed row exists, switch off", s && s.enabled === false, JSON.stringify(s));
  ok("bonus code seeded", s?.bonus_code === "TeamMM001" && s?.d === "2026-12-15");

  const rls = (await client.query(
    `select relname, relrowsecurity from pg_class
      where relname in ('support_settings','support_chats','support_events')`)).rows;
  ok("RLS on all three tables", rls.length === 3 && rls.every((r) => r.relrowsecurity));

  await client.query("begin");
  await client.query("set local role anon");
  let anonBlocked = false;
  try { await client.query("select 1 from public.support_events limit 1"); } catch { anonBlocked = true; }
  await client.query("rollback");
  ok("anon cannot read support_events", anonBlocked);

  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query(`select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true)`);
  const seen = (await client.query("select count(*)::int n from public.support_settings")).rows[0].n;
  await client.query("rollback");
  ok("a non-admin sees no settings row", seen === 0, `rows=${seen}`);

  await client.query("begin");
  const admin = (await client.query("select id from public.profiles where is_admin limit 1")).rows[0];
  if (!admin) {
    ok("no admin profile to test with", false);
  } else {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', json_build_object('sub', $1::uuid, 'role', 'authenticated')::text, true)",
      [admin.id]
    );
    const n = (await client.query("select count(*)::int n from public.support_settings")).rows[0].n;
    ok("an admin can read support_settings", n === 1);
    try {
      await client.query("select count(*)::int from public.support_events");
      ok("an admin can read support_events", true);
    } catch {
      ok("an admin can read support_events", false);
    }
  }
  await client.query("rollback");

  const job = (await client.query("select schedule from cron.job where jobname = 'support-events-purge'")).rows[0];
  ok("purge job scheduled daily", job?.schedule === "30 0 * * *");
} catch (e) {
  failed = true;
  console.error(e);
  await client.query("rollback").catch(() => {});
} finally {
  await client.end();
  process.exit(failed ? 1 : 0);
}

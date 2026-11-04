// Apply 20261104000006_fa_plain_summaries.sql via the IPv4 pooler and prove:
// the table exists with RLS on, and anon/authenticated can neither read nor
// write it (only the service role, from /api/fundamental/plain).
//
//   node scripts/apply-fa-plain-summaries.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-fa-plain-summaries.mjs             # apply for real, then prove
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000006_fa_plain_summaries.sql", import.meta.url), "utf8");
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

async function denied(role, sql) {
  await client.query("savepoint probe");
  try {
    await client.query(`set local role ${role}`);
    await client.query(sql);
    return false;
  } catch {
    return true;
  } finally {
    await client.query("rollback to savepoint probe");
  }
}

await client.connect();
try {
  await client.query("begin");
  await client.query(SQL);
  const t = await client.query(
    "select relrowsecurity from pg_class where oid = 'public.fa_plain_summaries'::regclass"
  );
  ok("table exists with RLS on", t.rows[0]?.relrowsecurity === true);
  const insert = "insert into public.fa_plain_summaries (instrument, generated_at, locale, body, model) values ('XAUUSD', now(), 'en', '{}', 'probe')";
  for (const role of ["anon", "authenticated"]) {
    ok(`${role} cannot read`, await denied(role, "select * from public.fa_plain_summaries"));
    ok(`${role} cannot write`, await denied(role, insert));
  }
  await client.query("savepoint svc");
  await client.query("set local role service_role");
  await client.query(insert);
  ok("service_role can write", true);
  await client.query("rollback to savepoint svc");
  await client.query(DRY || failed ? "rollback" : "commit");
  console.log(DRY ? "dry run: rolled back" : failed ? "checks failed: rolled back" : "applied");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("error:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
if (failed) process.exitCode = 1;

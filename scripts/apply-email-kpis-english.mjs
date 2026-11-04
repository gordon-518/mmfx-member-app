// Apply 20261104000005_email_kpis_english.sql via the IPv4 pooler and prove:
// the filter is in the live definition, the grants are unchanged (service
// role only), and today's numbers are exactly what they were — every send so
// far is English, so the KPIs must not move.
//
//   node scripts/apply-email-kpis-english.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-email-kpis-english.mjs             # apply for real, then prove
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000005_email_kpis_english.sql", import.meta.url), "utf8");
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

const KPIS = "select * from public.fn_email_kpis(now() - interval '90 days', now()) order by flow, step, variant";

async function denied(role) {
  await client.query("savepoint probe");
  try {
    await client.query(`set local role ${role}`);
    await client.query(KPIS);
    return false;
  } catch {
    return true;
  } finally {
    await client.query("rollback to savepoint probe");
    await client.query("reset role");
  }
}

try {
  await client.connect();
  await client.query("begin");
  const before = JSON.stringify((await client.query(KPIS)).rows);
  await client.query(SQL);
  const def = (await client.query(
    "select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'fn_email_kpis'")).rows;
  ok("one definition, with the English-only filter", def.length === 1 && def[0].d.includes("coalesce(es.locale, 'en') = 'en'"));
  const grants = (await client.query(
    "select string_agg(grantee, ',' order by grantee) g from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'fn_email_kpis'")).rows[0].g;
  ok("grants unchanged", grants === "postgres,service_role", grants);
  ok("anon cannot call it", await denied("anon"));
  ok("a member cannot call it", await denied("authenticated"));
  const after = JSON.stringify((await client.query(KPIS)).rows);
  ok("the last 90 days of KPIs are unchanged", before === after, `${JSON.parse(after).length} rows`);
  if (DRY) {
    await client.query("rollback");
    console.log("\nrolled back (dry run): nothing was kept");
  } else {
    await client.query("commit");
    console.log("\napplied");
  }
} catch (e) {
  failed = true;
  console.error("error:", e.message);
  await client.query("rollback").catch(() => {});
} finally {
  await client.end();
  process.exit(failed ? 1 : 0);
}

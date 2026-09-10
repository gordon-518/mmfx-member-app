// One-off: apply 20260910000004_free_tier_access.sql (conversion-fix 2.3) via
// the IPv4 pooler, then prove what a Free user can and can't read, as the real
// `authenticated` role inside a ROLLED-BACK transaction.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000004_free_tier_access.sql", import.meta.url), "utf8"
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
const n = async (sql, params = []) => (await client.query(sql, params)).rows[0].n;

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  // Ground truth, as postgres (bypasses RLS).
  const published = await n("select count(*)::int n from public.daily_analysis where is_published");
  const drafts = await n("select count(*)::int n from public.daily_analysis where not is_published");
  const publishedReports = await n(
    `select count(*)::int n from storage.objects o where o.bucket_id = 'analysis-reports'
       and exists (select 1 from public.daily_analysis d where d.report_path = o.name and d.is_published)`
  );
  const allReports = await n("select count(*)::int n from storage.objects where bucket_id = 'analysis-reports'");
  const free = (await client.query(
    `select id from public.profiles
      where account_status in ('trial_expired','re_trial_expired') and not coalesce(is_admin,false)
      order by signup_at desc limit 1`
  )).rows[0].id;
  console.log(`truth: ${published} published / ${drafts} drafts; reports ${publishedReports} published of ${allReports} objects\n`);

  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: free, role: "authenticated" }),
    ]);
    ok("Free user is not full access", (await client.query("select public.is_full_access() f")).rows[0].f === false);
    ok("Free: sees every published analysis",
      (await n("select count(*)::int n from public.daily_analysis")) === published, `(${published})`);
    ok("Free: sees no drafts",
      (await n("select count(*)::int n from public.daily_analysis where not is_published")) === 0);
    ok("Free: reads published report PDFs only",
      (await n("select count(*)::int n from storage.objects where bucket_id = 'analysis-reports'")) === publishedReports,
      `(${publishedReports} of ${allReports})`);
    const slides = (await client.query(
      "select coalesce(array_agg(name order by name), '{}') s from storage.objects where bucket_id = 'slides'"
    )).rows[0].s;
    ok("Free: exactly the 3 Module 1 decks", slides.length === 3, `[${slides.join(", ")}]`);
    ok("Free: no eBooks", (await n("select count(*)::int n from storage.objects where bucket_id = 'eBooks'")) === 0);
    ok("Free: no live classes", (await n("select count(*)::int n from public.live_classes")) === 0);

    await client.query("reset role");
    await client.query("set local role anon");
    await client.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    let anonAnalyses = -1;
    try { anonAnalyses = await n("select count(*)::int n from public.daily_analysis"); } catch { anonAnalyses = 0; }
    ok("anon: no analyses", anonAnalyses === 0);
    let anonSlides = -1;
    try { anonSlides = await n("select count(*)::int n from storage.objects where bucket_id = 'slides'"); } catch { anonSlides = 0; }
    ok("anon: no slides", anonSlides === 0);
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

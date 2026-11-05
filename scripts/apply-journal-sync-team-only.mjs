// Apply 20261105000003_journal_sync_team_only.sql via the IPv4 pooler and prove:
// the live definition before is 20261105000002's, the Team MM rule is in place,
// grants are unchanged (service role only), and list every connected account's
// owner with whether the cron would still queue it.
//
//   node scripts/apply-journal-sync-team-only.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-journal-sync-team-only.mjs             # apply for real, then prove
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261105000003_journal_sync_team_only.sql", import.meta.url), "utf8");
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
const DEF = "select pg_get_functiondef('public.fn_enqueue_due_sync_jobs(interval)'::regprocedure) d";
const ACL = "select proacl::text a from pg_proc where oid = 'public.fn_enqueue_due_sync_jobs(interval)'::regprocedure";
// The same owner rule as the migration, for a per-account readout.
const OWNERS = `select a.mt5_login, p.account_status, p.deposit_amount::float as deposits, p.grandfathered,
    p.lifetime_plan, p.is_admin, p.trial_ends_at > now() as in_trial,
    ((p.account_status in ('trial_active','re_trial_active','member_active') and p.trial_ends_at > now())
      or (p.account_status = 'member_active' and (coalesce(p.grandfathered,false)
          or nullif(p.lifetime_plan,'') is not null or coalesce(p.deposit_amount,0) >= 500
          or coalesce(p.is_admin,false)))) as syncs
  from public.journal_accounts a join public.profiles p on p.id = a.user_id
  where a.state = 'deployed' and a.metaapi_account_id is not null order by a.created_at`;

await client.connect();
try {
  await client.query("begin");
  const before = (await client.query(DEF)).rows[0].d;
  ok("live definition is 20261105000002's", before.includes("join public.profiles p") && !before.includes("deposit_amount"));
  const aclBefore = (await client.query(ACL)).rows[0].a;
  await client.query(SQL);
  const after = (await client.query(DEF)).rows[0].d;
  ok("Team MM rule is live", after.includes(">= 500") && after.includes("lifetime_plan"));
  ok("grants unchanged", (await client.query(ACL)).rows[0].a === aclBefore, aclBefore);
  const owners = (await client.query(OWNERS)).rows;
  for (const o of owners) {
    const login = String(o.mt5_login).replace(/.(?=.{3})/g, "•");
    console.log(`      ${login}  ${o.account_status}  $${o.deposits ?? 0}  grandfathered=${o.grandfathered}  lifetime=${o.lifetime_plan ?? "-"}  admin=${o.is_admin}  in_trial=${o.in_trial}  -> ${o.syncs ? "syncs" : "PAUSED"}`);
  }
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

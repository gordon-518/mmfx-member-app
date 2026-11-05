// Apply 20261105000002_journal_sync_active_owners.sql via the IPv4 pooler and
// prove: the live definition before matches 20260812000002 (no hotfix is being
// overwritten), the new filter is in place, grants are unchanged (service role
// only), and every currently connected account would still be queued — today
// only members and admins can connect, so nobody should lose syncing.
//
//   node scripts/apply-journal-sync-active-owners.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-journal-sync-active-owners.mjs             # apply for real, then prove
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261105000002_journal_sync_active_owners.sql", import.meta.url), "utf8");
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
const OWNERS = `select p.account_status, p.is_admin, count(*)::int n
  from public.journal_accounts a join public.profiles p on p.id = a.user_id
  where a.state = 'deployed' and a.metaapi_account_id is not null
  group by 1, 2 order by 1`;

await client.connect();
try {
  await client.query("begin");
  const before = (await client.query(DEF)).rows[0].d;
  ok("live definition is the 0812 one (no hotfix to overwrite)",
    before.includes("a.state = 'deployed'") && !before.includes("join public.profiles"));
  const aclBefore = (await client.query(ACL)).rows[0].a;
  const owners = (await client.query(OWNERS)).rows;
  console.log("connected accounts by owner status:", JSON.stringify(owners));

  await client.query(SQL);
  const after = (await client.query(DEF)).rows[0].d;
  ok("new owner filter is live", after.includes("join public.profiles p") && after.includes("trial_ends_at > now()"));
  ok("grants unchanged", (await client.query(ACL)).rows[0].a === aclBefore, aclBefore);
  const lapsed = owners.filter((o) => o.account_status !== "member_active" && !o.account_status.endsWith("_active"));
  ok("no currently connected account belongs to a lapsed owner", lapsed.length === 0, JSON.stringify(lapsed));

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

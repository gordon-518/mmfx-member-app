// Apply 20261104000004_support_reason_purge.sql via the IPv4 pooler and prove
// the job is scheduled with the right schedule and command.
//
//   node scripts/apply-support-reason-purge.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-support-reason-purge.mjs             # apply for real, then prove
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000004_support_reason_purge.sql", import.meta.url), "utf8");
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

async function prove() {
  const job = (await client.query(
    "select schedule, command from cron.job where jobname = 'support-chats-reason-purge'")).rows[0];
  ok("the job is scheduled nightly at 00:40", job?.schedule === "40 0 * * *", job?.schedule ?? "missing");
  ok("it never clears a chat still waiting for Amelia", /state <> 'needs_amelia'/.test(job?.command ?? ""));
  ok("it only clears reasons older than 90 days", /interval '90 days'/.test(job?.command ?? ""));
  const due = (await client.query(
    "select count(*)::int n from public.support_chats where handoff_reason is not null and state <> 'needs_amelia' and updated_at < now() - interval '90 days'")).rows[0].n;
  console.log(`      reasons the first run would clear today: ${due}`);
}

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await prove();
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

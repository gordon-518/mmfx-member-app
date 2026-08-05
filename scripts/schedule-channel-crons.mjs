// Schedule (or re-schedule) the MM Channel Bot pg_cron jobs against the live DB.
// Kept out of the migration because it needs APP_URL + CHANNEL_CRON_SECRET, which must
// never be committed. Idempotent: each job is unscheduled first, then created.
//
//   node scripts/schedule-channel-crons.mjs [--dry-run] [--unschedule]
//
// Jobs:
//   channel-dispatch      * * * * *              drain the post queue
//   channel-rotate-cta    0 0,4,8,12,16,20 * * * post one library item (every 4h)
//   channel-replenish-cta 0 1 * * *              retire duds + draft new copy
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const UNSCHEDULE_ONLY = process.argv.includes("--unschedule");

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const APP_URL = env.APP_URL || "https://app.marketmakersfx.net";
const CHANNEL_CRON_SECRET = env.CHANNEL_CRON_SECRET;
if (!CHANNEL_CRON_SECRET) { console.error("✗ CHANNEL_CRON_SECRET missing from .env.local"); process.exit(1); }

const JOBS = [
  { name: "channel-dispatch", schedule: "* * * * *", path: "/api/channel/dispatch" },
  { name: "channel-rotate-cta", schedule: "0 0,4,8,12,16,20 * * *", path: "/api/channel/rotate-cta" },
  { name: "channel-replenish-cta", schedule: "0 1 * * *", path: "/api/channel/replenish-cta" },
];

if (DRY) {
  console.log(`[DRY RUN] against ${APP_URL}`);
  for (const j of JOBS) console.log(`  ${j.name.padEnd(22)} ${j.schedule.padEnd(24)} → ${j.path}`);
  process.exit(0);
}

const direct = new URL(env.DATABASE_URL);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(direct.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  for (const j of JOBS) {
    // Idempotent: drop any existing job with this name first.
    await client.query(
      `select cron.unschedule(jobid) from cron.job where jobname = $1`, [j.name]
    );
    if (UNSCHEDULE_ONLY) { console.log(`  ✓ unscheduled ${j.name}`); continue; }

    const command = `select net.http_post(
        url     := '${APP_URL}${j.path}',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ${CHANNEL_CRON_SECRET}'),
        body    := '{}'::jsonb);`;
    await client.query(`select cron.schedule($1, $2, $3)`, [j.name, j.schedule, command]);
    console.log(`  ✓ scheduled ${j.name.padEnd(22)} ${j.schedule}`);
  }

  const r = await client.query(
    `select jobname, schedule, active from cron.job where jobname like 'channel-%' order by jobname`
  );
  console.log("\nActive channel jobs:");
  for (const row of r.rows) console.log(`  ${row.jobname.padEnd(22)} ${row.schedule.padEnd(24)} active=${row.active}`);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

// Schedule the daily intervention cron by CLONING the existing journal-sync
// pg_cron job — so the Bearer secret never leaves the DB (never printed here).
// Idempotent: re-running reschedules. Runs 13:00 UTC daily.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo", password, database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query("select command from cron.job where jobname = 'journal-sync'");
if (!rows.length) throw new Error("journal-sync job not found — cannot clone secret");
const syncCmd = rows[0].command;
if (!syncCmd.includes("/api/journal/cron/sync")) throw new Error("unexpected journal-sync command shape");
const cmd = syncCmd.replaceAll("/api/journal/cron/sync", "/api/journal/cron/interventions");

await client.query(
  "select cron.unschedule('journal-interventions') where exists (select 1 from cron.job where jobname = 'journal-interventions')"
);
await client.query("select cron.schedule('journal-interventions', '0 13 * * *', $1)", [cmd]);

const { rows: j } = await client.query(
  "select jobname, schedule, active from cron.job where jobname = 'journal-interventions'"
);
await client.end();
console.log("scheduled:", j); // jobname/schedule/active only — never the command/secret

// One-off: apply the journal_reports table + RLS to the live DB via the IPv4
// pooler. Reads the migration file so SQL isn't duplicated. Does NOT schedule
// the pg_cron job (needs CRON_SECRET, applied out-of-band). Idempotent.
import { readFileSync } from "node:fs";
import pg from "pg";

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

const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(
  new URL("../supabase/migrations/20260707000001_journal_reports.sql", import.meta.url),
  "utf8"
);

try {
  await client.connect();
  // Re-run safety: drop the policy first, but only if the table already exists
  // (a fresh DB has neither — the migration creates both).
  const { rows: exists } = await client.query(
    "select to_regclass('public.journal_reports') is not null as present"
  );
  if (exists[0].present) {
    await client.query(
      `drop policy if exists "journal_reports_select_own" on public.journal_reports`
    );
  }
  await client.query(sql);
  const { rows } = await client.query(
    "select count(*)::int as n from public.journal_reports"
  );
  console.log(`journal_reports migration applied ✔ (rows: ${rows[0].n})`);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

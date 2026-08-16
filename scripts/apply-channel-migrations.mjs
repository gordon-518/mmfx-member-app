// Apply the MM Channel Bot migrations to the live DB via the IPv4 pooler
// (direct host is IPv6-only), mirroring apply-growth-migration.mjs.
//
// Surgical on purpose: `supabase db push` would try to replay ~16 earlier
// migrations that were already applied out-of-band. This runs ONLY the three
// channel migrations, all of which are idempotent (if not exists / or replace).
//
// Does NOT schedule the pg_cron jobs — that needs CRON_SECRET and is done by
// scripts/schedule-channel-crons.mjs.
//
//   node scripts/apply-channel-migrations.mjs [--dry-run]
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");

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

const MIGRATIONS = [
  "20260629000001_channel_core.sql",
  "20260629000002_channel_engagement.sql",
  "20260629000003_visual_library.sql",
  "20260817000001_channel_weight.sql",
];

const sql = MIGRATIONS.map(
  (f) => `-- ===== ${f} =====\n` + readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")
).join("\n\n");

if (DRY) {
  console.log(`[DRY RUN] Would apply ${MIGRATIONS.length} migrations:\n  - ${MIGRATIONS.join("\n  - ")}`);
  console.log(`\nTotal SQL: ${sql.length} chars. No connection made.`);
  process.exit(0);
}

const direct = new URL(env.DATABASE_URL);
const password = decodeURIComponent(direct.password);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);

  const t = await client.query(
    `select table_name from information_schema.tables
      where table_schema='public' and table_name in ('channel_posts','content_library','visual_library')
      order by table_name`
  );
  console.log("tables:", t.rows.map((r) => r.table_name).join(", ") || "(none)");

  const c = await client.query(
    `select column_name from information_schema.columns
      where table_name='channel_posts' and column_name in ('clicks','reactions','button_set')
      order by column_name`
  );
  console.log("engagement columns:", c.rows.map((r) => r.column_name).join(", ") || "(none)");

  const v = await client.query(`select count(*)::int as n from information_schema.views where table_name='library_engagement'`);
  console.log("library_engagement view:", v.rows[0].n === 1);

  const f = await client.query(`select count(*)::int as n from pg_proc where proname='increment_post_clicks'`);
  console.log("increment_post_clicks fn:", f.rows[0].n >= 1);

  const b = await client.query(`select id, public from storage.buckets where id='channel-assets'`);
  console.log("channel-assets bucket:", b.rows[0] ? `present (public=${b.rows[0].public})` : "MISSING");

  console.log("\nOK — channel migrations applied");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

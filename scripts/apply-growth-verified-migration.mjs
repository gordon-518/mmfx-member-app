// One-off: apply 20260910000001_growth_daily_verified_members.sql to the live
// DB via the IPv4 pooler (the direct host is IPv6-only). Additive + idempotent.
// Reads the migration file itself so the SQL can't drift from what's committed.
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

const SQL = readFileSync(
  new URL("../supabase/migrations/20260910000001_growth_daily_verified_members.sql", import.meta.url),
  "utf8"
);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(SQL);
  const r = await client.query(
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'growth_daily'
        and column_name in ('members_verified', 'members_legacy') order by column_name`
  );
  console.table(r.rows);
  console.log(r.rows.length === 2 ? "OK — migration applied" : "MISSING COLUMNS");
  if (r.rows.length !== 2) process.exitCode = 1;
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

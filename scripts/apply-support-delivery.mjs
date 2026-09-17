// One-off: apply 20260915000012_support_delivery.sql, then prove the column
// exists and is nullable. Never prints .env.local, a password, a connection
// string, or any member data.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000012_support_delivery.sql", import.meta.url), "utf8");
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});
let failed = false;
const ok = (l, c, d = "") => { if (!c) failed = true; console.log(`${c ? "ok  " : "FAIL"}  ${l}${d ? "  " + d : ""}`); };
try {
  await client.connect();
  await client.query(SQL);
  const col = (await client.query(
    `select is_nullable from information_schema.columns
      where table_schema='public' and table_name='support_events' and column_name='delivered_at'`
  )).rows[0];
  ok("support_events.delivered_at exists", Boolean(col));
  ok("support_events.delivered_at is nullable", col?.is_nullable === "YES");
} catch (e) { failed = true; console.error(e); }
finally { await client.end(); process.exit(failed ? 1 : 0); }

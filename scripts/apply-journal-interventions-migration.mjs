// One-off: apply the journal_interventions + journal_email_prefs schema to the
// live DB via the IPv4 pooler. Mirrors scripts/apply-journal-rules-migration.mjs.
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
  new URL("../supabase/migrations/20260727000001_journal_interventions.sql", import.meta.url),
  "utf8"
);

await client.connect();
await client.query(sql);
const { rows } = await client.query("select count(*) from public.journal_interventions");
console.log("journal_interventions rows:", rows[0].count);
await client.end();
console.log("journal_interventions migration applied.");

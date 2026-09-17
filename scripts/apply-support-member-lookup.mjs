// One-off: apply 20260915000011_support_member_lookup.sql, then prove it resolves
// a real member's reference and refuses bad input.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000011_support_member_lookup.sql", import.meta.url), "utf8");
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
  const u = (await client.query("select id from public.profiles order by signup_at desc limit 1")).rows[0].id;
  const hex = u.replace(/-/g, "").slice(0, 6).toUpperCase();
  const got = (await client.query("select public.fn_support_member_by_ref($1) id", [hex])).rows[0].id;
  ok("resolves a real reference", got === u, `MM-${hex}`);
  const bad = (await client.query("select public.fn_support_member_by_ref($1) id", ["zz'--"])).rows[0].id;
  ok("refuses non-hex input", bad === null);
  const grants = (await client.query(
    `select coalesce(array_agg(grantee::text order by grantee::text), '{}') g from information_schema.routine_privileges
      where routine_schema='public' and routine_name='fn_support_member_by_ref' and privilege_type='EXECUTE'`)).rows[0].g;
  ok("only service_role (and owner) can execute", !grants.includes("anon") && !grants.includes("authenticated"), JSON.stringify(grants));
} catch (e) { failed = true; console.error(e); }
finally { await client.end(); process.exit(failed ? 1 : 0); }

// One-off: apply 20260915000006_drop_old_submit_deposit.sql via the IPv4
// pooler, then confirm only the Telegram-aware fn_submit_deposit remains,
// still callable by authenticated users and never by anon/PUBLIC.
import { readFileSync } from "node:fs";
import pg from "pg";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const SQL = readFileSync(new URL("../supabase/migrations/20260915000006_drop_old_submit_deposit.sql", import.meta.url), "utf8");
const c = new pg.Client({ host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432, user: "postgres.dldrcitoeoxzfctsqlmo", password: decodeURIComponent(new URL(env.DATABASE_URL).password), database: "postgres", ssl: { rejectUnauthorized: false } });
let failed = false;
const ok = (l, cond, d = "") => { if (!cond) failed = true; console.log(`${cond ? "ok  " : "FAIL"}  ${l}${d ? "  " + d : ""}`); };
try {
  await c.connect();
  await c.query("begin"); await c.query(SQL); await c.query("commit");
  const sigs = (await c.query("select oid::regprocedure::text s from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_submit_deposit'")).rows.map((r) => r.s);
  ok("only the 6-argument fn_submit_deposit remains", sigs.length === 1 && sigs[0].split(",").length === 6, JSON.stringify(sigs));
  const g = (await c.query(`select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'fn_submit_deposit' and privilege_type = 'EXECUTE'`)).rows[0].g;
  ok("grants: authenticated, never anon/PUBLIC", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);
  console.log(failed ? "FAILED" : "OK — old overload dropped");
  if (failed) process.exitCode = 1;
} catch (e) { await c.query("rollback").catch(() => {}); console.error("FAILED:", e.message); process.exitCode = 1; } finally { await c.end(); }

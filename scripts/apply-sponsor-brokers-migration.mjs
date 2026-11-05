// Apply 20261105000002_sponsor_brokers.sql via the IPv4 pooler, then prove in a
// ROLLED-BACK transaction that fn_sponsor_set now accepts gtc and weby and
// still refuses an unknown id. `--dry-run` keeps the migration itself inside
// the rolled-back transaction.
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261105000002_sponsor_brokers.sql", import.meta.url), "utf8");
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

let failed = false;
const ok = (label, cond, detail = "") => { if (!cond) failed = true; console.log(`${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`); };
const raises = async (sql, re) => {
  await client.query("savepoint s");
  try { await client.query(sql); await client.query("release savepoint s"); return false; }
  catch (e) { await client.query("rollback to savepoint s"); return re.test(e.message); }
};

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  if (DRY) console.log("migration ran — dry run, kept inside this transaction\n");
  else { await client.query("commit"); console.log("migration applied\n"); await client.query("begin"); }

  await client.query("select public.fn_partner_create('zzbrokertest', 'Throwaway')");
  await client.query("select public.fn_sponsor_set('zzbrokertest', array['gtc'])");
  ok("gtc accepted", (await client.query("select brokers from public.partners where slug = 'zzbrokertest'")).rows[0].brokers.join() === "gtc");
  await client.query("select public.fn_sponsor_set('zzbrokertest', array['weby'])");
  ok("weby accepted", (await client.query("select brokers from public.partners where slug = 'zzbrokertest'")).rows[0].brokers.join() === "weby");
  await client.query("select public.fn_sponsor_set('zzbrokertest', array['octa', 'elev8'])");
  ok("octa + elev8 still accepted", true);
  ok("an unknown broker is still refused", await raises("select public.fn_sponsor_set('zzbrokertest', array['xyz'])", /must be among/));
  const g = (await client.query(`select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'fn_sponsor_set' and privilege_type = 'EXECUTE'`)).rows[0].g;
  ok("fn_sponsor_set: service_role only", g.includes("service_role") && !g.includes("anon") && !g.includes("authenticated") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);
} catch (e) {
  failed = true; console.error("\nFAIL ", e.message);
} finally {
  try { await client.query("rollback"); } catch { /* closed */ }
  await client.end();
}
console.log(failed ? "\nSOMETHING FAILED" : DRY ? "\nall checks passed — dry run, nothing kept" : "\nall checks passed — migration is live");
process.exit(failed ? 1 : 0);

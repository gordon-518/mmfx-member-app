// Apply 20261105000001_sponsor_dashboard.sql via the IPv4 pooler, then prove it
// inside a ROLLED-BACK transaction: grants, browser roles refused, the sponsor
// writers and readers answering for two throwaway sponsors. Counts only are
// printed. `--dry-run` keeps the migration itself inside the rolled-back
// transaction, so nothing is kept.
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261105000001_sponsor_dashboard.sql", import.meta.url), "utf8");
const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password: decodeURIComponent(new URL(env.DATABASE_URL).password),
  database: "postgres", ssl: { rejectUnauthorized: false },
});

let failed = false;
const ok = (label, cond, detail = "") => {
  if (!cond) failed = true;
  console.log(`${cond ? "ok  " : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};
const as = async (role) => {
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role })]);
};
// True when the statement is refused for lack of privilege. Savepointed so the
// failed statement does not abort the surrounding transaction.
const refused = async (sql) => {
  await client.query("savepoint s");
  try {
    await client.query(sql);
    await client.query("release savepoint s");
    return false;
  } catch (e) {
    await client.query("rollback to savepoint s");
    return /permission denied/i.test(e.message);
  }
};

const FNS = ["fn_sponsor_set", "fn_sponsor_window_set", "fn_sponsor_windows", "fn_sponsor_funnel", "fn_sponsor_clients"];

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  if (DRY) {
    console.log("migration ran — dry run, kept inside this transaction\n");
  } else {
    await client.query("commit");
    console.log("migration applied\n");
    await client.query("begin");
  }

  for (const fn of FNS) {
    const g = (await client.query(
      `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
         from information_schema.routine_privileges
        where routine_schema = 'public' and routine_name = $1 and privilege_type = 'EXECUTE'`,
      [fn]
    )).rows[0].g;
    ok(`${fn}: service_role only`,
      g.includes("service_role") && !g.includes("anon") && !g.includes("authenticated") && !g.includes("PUBLIC"),
      `[${g.join(", ")}]`);
  }

  const ren = (await client.query("select kind, brokers from public.partners where slug = 'ren'")).rows[0];
  ok("Ren is still an agency with no brokers", !ren || (ren.kind === "agency" && ren.brokers === null));

  const key = (await client.query("select public.fn_partner_create('zzsponsortest', 'Throwaway sponsor') k")).rows[0].k;
  ok("throwaway partner minted", typeof key === "string" && key.length === 64);
  await client.query("select public.fn_sponsor_set('zzsponsortest', array['octa', 'elev8'])");
  await client.query("select public.fn_sponsor_window_set('zzsponsortest', 'MY', '2026-01-01', null)");
  const w = (await client.query("select * from public.fn_sponsor_windows('zzsponsortest')")).rows;
  ok("window on file", w.length === 1 && w[0].country === "MY");

  await client.query("select public.fn_partner_create('zzsponsortwo', 'Second throwaway')");
  await client.query("select public.fn_sponsor_set('zzsponsortwo', array['dupoin'])");
  let clash = false;
  await client.query("savepoint o");
  try {
    await client.query("select public.fn_sponsor_window_set('zzsponsortwo', 'MY', '2026-06-01', null)");
  } catch (e) {
    clash = /already sponsors/.test(e.message);
  }
  await client.query("rollback to savepoint o");
  ok("a second sponsor for the same country and period is refused", clash);
  await client.query("select public.fn_sponsor_window_set('zzsponsortwo', 'SG', '2026-06-01', null)");
  ok("a different country is fine", true);

  await client.query("select public.fn_sponsor_window_set('zzsponsortest', 'MY', '2026-03-01', null)");
  const w2 = (await client.query("select * from public.fn_sponsor_windows('zzsponsortest')")).rows;
  ok("re-running a window for the same sponsor replaces it",
    w2.length === 1 && new Date(w2[0].since).toISOString().startsWith("2026-03-01"));

  const f = (await client.query("select * from public.fn_sponsor_funnel('zzsponsortest', null, null)")).rows;
  const sum = (k) => f.reduce((a, r) => a + Number(r[k]), 0);
  const traced = f.filter((r) => r.label !== null).reduce((a, r) => a + Number(r.signups), 0);
  ok("funnel answers", Array.isArray(f),
    `${f.length} rows · signups ${sum("signups")} · activated ${sum("activated")} · upgrade ${sum("upgrade_viewed")} · clicked ${sum("broker_clicked")} · submitted ${sum("submitted")} · funded ${sum("funded")} · traced ${traced} · $${sum("deposit_total")}`);

  const c = (await client.query("select * from public.fn_sponsor_clients('zzsponsortest', null, null, 5, 0)")).rows;
  const cols = c.length ? Object.keys(c[0]).sort().join(",") : "";
  ok("clients answers with the masked columns only",
    c.length === 0 || cols === "account_number,ad_label,country,deposit_total,display,signed_up,stage,total",
    `${c.length} of ${c[0]?.total ?? 0} rows · columns ${cols}`);
  ok("no display name carries an @", c.every((r) => r.display === null || !r.display.includes("@")));
  ok("no display name is longer than first name + initial allows", c.every((r) => r.display === null || r.display.length <= 27));
  ok("account number only when funded", c.every((r) => r.stage === "funded" || r.account_number === null));

  for (const role of ["anon", "authenticated"]) {
    await as(role);
    ok(`${role} cannot read partner_countries`, await refused("select * from public.partner_countries"));
    ok(`${role} cannot call fn_sponsor_funnel`, await refused("select * from public.fn_sponsor_funnel('zzsponsortest', null, null)"));
    ok(`${role} cannot call fn_sponsor_clients`, await refused("select * from public.fn_sponsor_clients('zzsponsortest', null, null, 5, 0)"));
    ok(`${role} cannot call fn_sponsor_window_set`, await refused("select public.fn_sponsor_window_set('zzsponsortest', 'ID', '2026-01-01', null)"));
    await client.query("reset role");
  }
} catch (e) {
  failed = true;
  console.error("\nFAIL ", e.message);
} finally {
  try { await client.query("rollback"); } catch { /* already closed */ }
  await client.end();
}

console.log(failed ? "\nSOMETHING FAILED" : DRY ? "\nall checks passed — dry run, nothing kept" : "\nall checks passed — migration is live");
process.exit(failed ? 1 : 0);

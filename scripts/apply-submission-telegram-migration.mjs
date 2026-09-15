// One-off: apply 20260915000005_submission_telegram.sql via the IPv4 pooler,
// then prove it as the real roles inside a ROLLED-BACK transaction: a
// submission without a valid Telegram username is refused; a valid one is
// stored without the @.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260915000005_submission_telegram.sql", import.meta.url), "utf8");
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
const tries = async (sql, params = []) => {
  await client.query("savepoint t");
  try { const r = await client.query(sql, params); await client.query("release savepoint t"); return r; }
  catch (e) { await client.query("rollback to savepoint t"); return e.message; }
};

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const g = (await client.query(
    `select coalesce(array_agg(distinct grantee::text order by grantee::text), '{}')::text[] g
       from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'fn_submit_deposit' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("grants: authenticated, never anon/PUBLIC", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);
  const n = (await client.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_submit_deposit'")).rows[0].n;
  ok("both overloads exist during rollout (old 5-arg until the deploy is live)", n === 2, `(${n})`);

  const user = (await client.query(
    `select p.id from public.profiles p where p.account_status = 'trial_active' and not coalesce(p.is_admin,false)
       and not exists (select 1 from public.deposit_submissions s where s.user_id = p.id and s.status = 'pending')
     order by p.signup_at desc limit 1`
  )).rows[0].id;
  const path = `${user}/tg-test.png`;

  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
    await client.query("insert into storage.objects (bucket_id, name, owner) values ('deposit-proofs', $1, $2)", [path, user]);
    const submit = (tg) => tries("select telegram_username from public.fn_submit_deposit('octa', '5012345', 100, null::text, $1::text, $2::text)", [path, tg]);
    ok("missing Telegram username refused", /Telegram username/.test(await submit(null)));
    ok("invalid Telegram username refused", /Telegram username/.test(await submit("ab")));
    const r = await submit("@mmfx_trader");
    ok("valid @handle accepted, stored without the @", typeof r !== "string" && r.rows[0].telegram_username === "mmfx_trader",
      typeof r === "string" ? r : r.rows[0].telegram_username);
  } finally {
    await client.query("rollback");
  }

  console.log(failed ? "\nFAILED — see above" : "\nOK — migration applied and verified (checks rolled back)");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

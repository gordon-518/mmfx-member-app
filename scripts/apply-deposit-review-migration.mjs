// One-off: apply 20260910000009_deposit_review.sql (conversion-fix 5.2) via the
// IPv4 pooler, then prove the review path as the real roles inside a
// ROLLED-BACK transaction: a user submits $100; a non-admin can't review; an
// admin's verify makes them a member with a ledger row and their account
// number saved; a second review is refused; reject needs a reason.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260910000009_deposit_review.sql", import.meta.url), "utf8");
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
const as = async (role, uid) => {
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role } : { role })]);
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
      where routine_schema = 'public' and routine_name = 'fn_review_deposit_submission' and privilege_type = 'EXECUTE'`
  )).rows[0].g;
  ok("grants: authenticated, never anon/PUBLIC", g.includes("authenticated") && !g.includes("anon") && !g.includes("PUBLIC"), `[${g.join(", ")}]`);

  // Two trials with no trading account number, so saving it is observable.
  const [u1, u2] = (await client.query(
    `select id from public.profiles where account_status = 'trial_active' and trial_ends_at > now()
       and trading_account_number is null and not coalesce(is_admin,false) order by signup_at desc limit 2`
  )).rows.map((r) => r.id);
  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;

  await client.query("begin");
  try {
    // Each user uploads a proof and submits (the 5.1 path).
    const ids = [];
    for (const [u, amt] of [[u1, 100], [u2, 60]]) {
      await as("authenticated", u);
      await client.query("insert into storage.objects (bucket_id, name, owner) values ('deposit-proofs', $1, $2)", [`${u}/p.png`, u]);
      const r = await client.query("select id from public.fn_submit_deposit('octa', '5012345', $1, null, $2)", [amt, `${u}/p.png`]);
      ids.push(r.rows[0].id);
      await client.query("reset role");
    }
    const [s1, s2] = ids;

    await as("authenticated", u2);
    ok("a non-admin can't review", /admins only/.test(await tries("select public.fn_review_deposit_submission($1, 'verify', null, true)", [s1])));
    await client.query("reset role");

    await as("authenticated", admin);
    const v = await tries("select status from public.fn_review_deposit_submission($1, 'verify', null, true)", [s1]);
    ok("admin verify succeeds", typeof v !== "string" && v.rows[0].status === "verified", typeof v === "string" ? v : "");
    ok("a second review is refused", /already verified/.test(await tries("select public.fn_review_deposit_submission($1, 'reject', 'x', false)", [s1])));
    ok("verify without IB confirmation is refused (fn_verify_deposit rule)",
      /IB link attribution not confirmed/.test(await tries("select public.fn_review_deposit_submission($1, 'verify', null, false)", [s2])));
    ok("reject without a reason is refused", /reason/.test(await tries("select public.fn_review_deposit_submission($1, 'reject', '  ', false)", [s2])));
    const rj = await tries("select status, reject_reason from public.fn_review_deposit_submission($1, 'reject', 'Screenshot does not show the account number', false)", [s2]);
    ok("reject with a reason succeeds", typeof rj !== "string" && rj.rows[0].status === "rejected", typeof rj === "string" ? rj : rj.rows[0].reject_reason);
    await client.query("reset role");

    const p1 = (await client.query("select account_status, deposit_amount, trading_account_number from public.profiles where id = $1", [u1])).rows[0];
    ok("verified user is member_active at $100 with the account number saved",
      p1.account_status === "member_active" && Number(p1.deposit_amount) === 100 && p1.trading_account_number === "5012345", JSON.stringify(p1));
    const led = (await client.query("select count(*)::int n, bool_and(verified_by = $2) by_admin from public.deposit_events where user_id = $1", [u1, admin])).rows[0];
    ok("one ledger row, verified_by = the reviewing admin", led.n === 1 && led.by_admin === true, JSON.stringify(led));
    const p2 = (await client.query("select account_status from public.profiles where id = $1", [u2])).rows[0];
    ok("rejected user is unchanged (still a trial)", p2.account_status === "trial_active");
  } finally {
    await client.query("rollback");
  }

  console.log(failed ? "\nFAILED — see above" : "\nOK — migration applied and verified (scenario rolled back)");
  if (failed) process.exitCode = 1;
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED (rolled back):", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

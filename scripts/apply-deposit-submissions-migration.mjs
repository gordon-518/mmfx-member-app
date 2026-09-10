// One-off: apply 20260910000008_deposit_submissions.sql (conversion-fix 5.1)
// via the IPv4 pooler, then prove it as the real roles inside a ROLLED-BACK
// transaction: the bucket is private, a user can upload only to their own
// folder and can't read proofs, a valid submission lands as pending and logs
// deposit_submitted, a second pending one and bad input are refused, users
// can't insert or update submissions directly, and admins can read both.
import { readFileSync } from "node:fs";
import pg from "pg";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20260910000008_deposit_submissions.sql", import.meta.url), "utf8");
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
// Run a statement inside a savepoint; return true if it succeeded.
const tries = async (sql, params = []) => {
  await client.query("savepoint t");
  try { await client.query(sql, params); await client.query("release savepoint t"); return true; }
  catch (e) { await client.query("rollback to savepoint t"); return e.message; }
};

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  await client.query("commit");
  console.log("migration applied\n");

  const bucket = (await client.query("select public from storage.buckets where id = 'deposit-proofs'")).rows[0];
  ok("deposit-proofs bucket exists and is private", bucket && bucket.public === false);

  const user = (await client.query(
    "select id from public.profiles where account_status = 'trial_active' and not coalesce(is_admin,false) order by signup_at desc limit 1"
  )).rows[0].id;
  const other = (await client.query(
    "select id from public.profiles where id <> $1 and not coalesce(is_admin,false) order by signup_at desc limit 1", [user]
  )).rows[0].id;
  const admin = (await client.query("select id from public.profiles where is_admin order by created_at limit 1")).rows[0].id;
  const own = `${user}/smoke-proof.png`;

  await client.query("begin");
  try {
    await as("authenticated", user);
    ok("user uploads to their own folder",
      (await tries("insert into storage.objects (bucket_id, name, owner) values ('deposit-proofs', $1, $2)", [own, user])) === true);
    ok("user can't upload into someone else's folder",
      (await tries("insert into storage.objects (bucket_id, name, owner) values ('deposit-proofs', $1, $2)", [`${other}/x.png`, user])) !== true);
    ok("user can't read proofs, even their own",
      (await client.query("select count(*)::int n from storage.objects where bucket_id = 'deposit-proofs'")).rows[0].n === 0);

    const submit = (amt, path = own) =>
      tries("select public.fn_submit_deposit('octa', '5012345', $1, 'smoke_user', $2)", [amt, path]);
    ok("$49 refused", /minimum deposit is \$50/.test(await submit(49)));
    ok("a proof outside the user's folder is refused", /Upload a screenshot/.test(await submit(100, `${other}/x.png`)));
    ok("a proof that doesn't exist is refused", /Upload a screenshot/.test(await submit(100, `${user}/missing.png`)));
    ok("a valid $100 submission succeeds", (await submit(100)) === true);
    ok("a second pending submission is refused", /already have a deposit waiting/.test(await submit(150)));

    const mine = (await client.query("select status, amount from public.deposit_submissions where user_id = $1", [user])).rows;
    ok("the user sees their own pending submission", mine.length === 1 && mine[0].status === "pending", JSON.stringify(mine));
    ok("the user can't insert directly",
      (await tries("insert into public.deposit_submissions (user_id, broker, trading_account_number, amount, proof_path) values ($1, 'octa', '123456', 60, $2)", [user, own])) !== true);
    ok("the user can't mark it verified",
      (await tries("update public.deposit_submissions set status = 'verified' where user_id = $1", [user])) !== true
      || (await client.query("select status from public.deposit_submissions where user_id = $1", [user])).rows[0].status === "pending");

    await client.query("reset role");
    ok("deposit_submitted was logged",
      (await client.query("select count(*)::int n from public.app_events where user_id = $1 and event = 'deposit_submitted'", [user])).rows[0].n === 1);

    await as("authenticated", other);
    ok("another user can't see it",
      (await client.query("select count(*)::int n from public.deposit_submissions where user_id = $1", [user])).rows[0].n === 0);
    await client.query("reset role");

    await as("authenticated", admin);
    ok("admin sees the submission",
      (await client.query("select count(*)::int n from public.deposit_submissions where user_id = $1", [user])).rows[0].n === 1);
    ok("admin can read the proof object",
      (await client.query("select count(*)::int n from storage.objects where bucket_id = 'deposit-proofs' and name = $1", [own])).rows[0].n === 1);
    const funnel = (await client.query("select public.fn_admin_funnel_stats(30) s")).rows[0].s;
    ok("the /stats funnel counts deposit_submitted", (funnel.funnel?.deposit_submitted ?? 0) >= 1, JSON.stringify(funnel.funnel));
    await client.query("reset role");

    await as("anon", null);
    ok("anon can't submit", (await tries("select public.fn_submit_deposit('octa', '5012345', 100, null, $1)", [own])) !== true);
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

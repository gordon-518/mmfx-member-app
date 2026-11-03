// Apply 20261104000002_member_chat_hardening.sql via the IPv4 pooler, then
// prove it as real roles: fn_chat_claim is service-role only, gives one claim
// per member at a time, enforces the hourly limit, and reads are admin-only.
//
//   node scripts/apply-member-chat-hardening.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-member-chat-hardening.mjs             # apply for real, then prove (proof rolled back)
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000002_member_chat_hardening.sql", import.meta.url), "utf8");
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

/** Runs `sql` as `role` (with `uid` as auth.uid()) inside a savepoint that is always rolled back. */
async function as(role, uid, sql, params = []) {
  await client.query("savepoint probe");
  try {
    await client.query(`set local role ${role}`);
    if (uid) {
      await client.query(
        "select set_config('request.jwt.claims', json_build_object('sub', $1::uuid, 'role', 'authenticated')::text, true)",
        [uid]
      );
    }
    const res = await client.query(sql, params);
    return { rows: res.rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await client.query("rollback to savepoint probe");
    await client.query("reset role");
  }
}

/** Like `as`, but keeps what the statement did (still inside the outer transaction). */
async function keep(role, sql, params = []) {
  await client.query(`set local role ${role}`);
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.query("reset role");
  }
}

async function prove() {
  const col = (await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='chat_threads' and column_name='busy_until'")).rows.length;
  ok("chat_threads.busy_until exists", col === 1);

  const members = (await client.query("select id from public.profiles where not coalesce(is_admin, false) order by created_at limit 1")).rows;
  const admin = (await client.query("select id from public.profiles where is_admin limit 1")).rows[0];
  if (!members.length || !admin) {
    ok("profiles to test with", false);
    return;
  }
  const a = members[0].id;

  const anon = await as("anon", null, "select public.fn_chat_claim($1, 'en', 20)", [a]);
  ok("anon cannot call fn_chat_claim", Boolean(anon.error), anon.error ?? "");
  const authd = await as("authenticated", a, "select public.fn_chat_claim($1, 'en', 20)", [a]);
  ok("a member cannot call fn_chat_claim directly", Boolean(authd.error), authd.error ?? "");

  const first = (await keep("service_role", "select public.fn_chat_claim($1, 'ms', 20) r", [a]))[0].r;
  ok("the service role gets the claim", first === "ok", first);
  const second = (await keep("service_role", "select public.fn_chat_claim($1, 'ms', 20) r", [a]))[0].r;
  ok("a second request while the first is in flight is 'busy'", second === "busy", second);
  const locale = (await client.query("select locale, busy_until > now() held from public.chat_threads where user_id = $1", [a])).rows[0];
  ok("the claim created the thread with the member's language", locale?.locale === "ms" && locale?.held === true, JSON.stringify(locale));

  await keep("service_role", "update public.chat_threads set busy_until = null where user_id = $1", [a]);
  await client.query(
    "insert into public.chat_messages (user_id, role, body) select $1, 'member', 'proof ' || g from generate_series(1, 3) g",
    [a]
  );
  const limited = (await keep("service_role", "select public.fn_chat_claim($1, 'ms', 3) r", [a]))[0].r;
  ok("at the hourly limit the claim is 'rate_limited'", limited === "rate_limited", limited);
  const freed = (await client.query("select busy_until from public.chat_threads where user_id = $1", [a])).rows[0];
  ok("a rate-limited claim doesn't keep the member locked", freed?.busy_until === null);
  await client.query("update public.chat_threads set busy_until = now() - interval '1 second' where user_id = $1", [a]);
  const expired = (await keep("service_role", "select public.fn_chat_claim($1, 'ms', 20) r", [a]))[0].r;
  ok("an expired claim (a killed request) can be taken again", expired === "ok", expired);

  const memberReads = await as("authenticated", a, "select count(*)::int n from public.chat_messages");
  ok("a member can no longer read chat_messages directly", memberReads.rows?.[0]?.n === 0, JSON.stringify(memberReads.rows ?? memberReads.error));
  const memberThread = await as("authenticated", a, "select count(*)::int n from public.chat_threads");
  ok("a member can no longer read chat_threads directly", memberThread.rows?.[0]?.n === 0, JSON.stringify(memberThread.rows ?? memberThread.error));
  const adminReads = await as("authenticated", admin.id, "select count(*)::int n from public.chat_messages where user_id = $1", [a]);
  ok("an admin still reads them", adminReads.rows?.[0]?.n === 3, JSON.stringify(adminReads.rows ?? adminReads.error));
  const anonRead = await as("anon", null, "select count(*)::int n from public.chat_messages");
  ok("anon still cannot read", Boolean(anonRead.error));

  const jobs = (await client.query("select jobname, schedule from cron.job where jobname in ('chat-messages-purge','chat-threads-purge') order by jobname")).rows;
  ok("both purge jobs scheduled", jobs.length === 2, JSON.stringify(jobs));
}

try {
  await client.connect();
  await client.query("begin");
  await client.query(SQL);
  if (DRY) {
    console.log("migration applied inside a transaction (dry run)\n");
    await prove();
    await client.query("rollback");
    console.log("\nrolled back: nothing was kept");
  } else {
    await client.query("commit");
    console.log("migration applied\n");
    await client.query("begin");
    await prove();
    await client.query("rollback");
    console.log("\nproof rows rolled back");
  }
} catch (e) {
  failed = true;
  console.error("error:", e.message);
  await client.query("rollback").catch(() => {});
} finally {
  await client.end();
}
process.exit(failed ? 1 : 0);

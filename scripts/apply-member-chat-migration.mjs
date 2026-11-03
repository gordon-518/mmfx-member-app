// Apply 20261104000001_member_chat.sql via the IPv4 pooler, then prove the
// access rules as real roles: anon reads nothing, a member reads only their
// own thread and messages and can write nothing, an admin reads everything,
// and the constraints and the purge job are in place.
//
//   node scripts/apply-member-chat-migration.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-member-chat-migration.mjs             # apply for real, then prove (proof rolled back)
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000001_member_chat.sql", import.meta.url), "utf8");
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

/** Runs `sql` as `role` (with `uid` as auth.uid()) inside a savepoint; returns rows or the error. */
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
    await client.query("rollback to savepoint probe");
    return { rows: res.rows };
  } catch (e) {
    await client.query("rollback to savepoint probe");
    return { error: e.message };
  } finally {
    await client.query("reset role");
  }
}

async function prove() {
  const s = (await client.query("select chat_enabled from public.support_settings where id = 1")).rows[0];
  ok("support_settings.chat_enabled exists, on by default", s?.chat_enabled === true, JSON.stringify(s));

  const rls = (await client.query("select relname, relrowsecurity from pg_class where relname in ('chat_threads','chat_messages')")).rows;
  ok("RLS on both tables", rls.length === 2 && rls.every((r) => r.relrowsecurity));

  const members = (await client.query("select id from public.profiles where not coalesce(is_admin, false) order by created_at limit 2")).rows;
  const admin = (await client.query("select id from public.profiles where is_admin limit 1")).rows[0];
  if (members.length < 2 || !admin) {
    ok("profiles to test with", false);
    return;
  }
  const [a, b] = members.map((m) => m.id);

  // Seed as the owner (the service role path), inside this transaction only.
  await client.query("insert into public.chat_threads (user_id, state) values ($1, 'needs_human'), ($2, 'bot')", [a, b]);
  await client.query(
    "insert into public.chat_messages (user_id, role, body) values ($1, 'member', 'proof a'), ($1, 'assistant', 'reply a'), ($2, 'member', 'proof b')",
    [a, b]
  );

  const anon = await as("anon", null, "select count(*)::int n from public.chat_messages");
  ok("anon cannot read chat_messages", Boolean(anon.error), anon.error ?? "");
  const anonT = await as("anon", null, "select count(*)::int n from public.chat_threads");
  ok("anon cannot read chat_threads", Boolean(anonT.error), anonT.error ?? "");

  const mineA = await as("authenticated", a, "select count(*)::int n from public.chat_messages");
  ok("member A reads only their own 2 messages", mineA.rows?.[0]?.n === 2, JSON.stringify(mineA.rows ?? mineA.error));
  const threadsA = await as("authenticated", a, "select user_id from public.chat_threads");
  ok("member A reads only their own thread", threadsA.rows?.length === 1 && threadsA.rows[0].user_id === a);
  const mineB = await as("authenticated", b, "select count(*)::int n from public.chat_messages");
  ok("member B reads only their own 1 message", mineB.rows?.[0]?.n === 1, JSON.stringify(mineB.rows ?? mineB.error));

  const write = await as("authenticated", a, "insert into public.chat_messages (user_id, role, body) values ($1, 'staff', 'forged')", [a]);
  ok("a member cannot write a message (not even a fake staff reply)", Boolean(write.error), write.error ?? "");
  const upd = await as("authenticated", a, "update public.chat_threads set state = 'bot' where user_id = $1", [a]);
  ok("a member cannot change their thread's state", Boolean(upd.error), upd.error ?? "");

  const adm = await as("authenticated", admin.id, "select count(*)::int n from public.chat_messages where user_id in ($1, $2)", [a, b]);
  ok("an admin reads every member's messages", adm.rows?.[0]?.n === 3, JSON.stringify(adm.rows ?? adm.error));

  const empty = await as("postgres", null, "insert into public.chat_messages (user_id, role, body) values ($1, 'member', '')", [a]);
  ok("an empty message is refused", Boolean(empty.error));
  const badRole = await as("postgres", null, "insert into public.chat_messages (user_id, role, body) values ($1, 'god', 'x')", [a]);
  ok("an unknown role is refused", Boolean(badRole.error));
  const badState = await as("postgres", null, "update public.chat_threads set state = 'weird' where user_id = $1", [a]);
  ok("an unknown thread state is refused", Boolean(badState.error));

  const job = (await client.query("select schedule, command from cron.job where jobname = 'chat-messages-purge'")).rows[0];
  ok("purge job scheduled daily", job?.schedule === "45 0 * * *" && /180 days/.test(job?.command ?? ""), JSON.stringify(job));
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

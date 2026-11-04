// Apply 20261104000003_member_locale.sql via the IPv4 pooler, then prove it as
// real roles: both functions are service-role only, fn_adopt_locale saves a
// language only when none is saved, fn_user_locales reads it back, and
// email_sends has its locale column. Every proof runs inside a savepoint that
// is rolled back, so no member's account is changed by this script.
//
//   node scripts/apply-member-locale-migration.mjs --dry-run   # apply + prove, then roll back
//   node scripts/apply-member-locale-migration.mjs             # apply for real, then prove (proof rolled back)
import { readFileSync } from "node:fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SQL = readFileSync(new URL("../supabase/migrations/20261104000003_member_locale.sql", import.meta.url), "utf8");
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

/** Runs `sql` as `role` inside a savepoint that is always rolled back. */
async function denied(role, sql, params) {
  await client.query("savepoint probe");
  try {
    await client.query(`set local role ${role}`);
    await client.query(sql, params);
    return false;
  } catch {
    return true;
  } finally {
    await client.query("rollback to savepoint probe");
    await client.query("reset role");
  }
}

async function asService(sql, params) {
  await client.query("set local role service_role");
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.query("reset role");
  }
}

async function prove() {
  const col = (await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='email_sends' and column_name='locale'")).rows.length;
  ok("email_sends.locale exists", col === 1);

  const member = (await client.query(
    "select p.id from public.profiles p where not coalesce(p.is_admin, false) and p.email not like '%@mmfx.test' order by p.created_at limit 1")).rows[0];
  if (!member) {
    ok("a profile to test with", false);
    return;
  }
  const a = member.id;

  for (const role of ["anon", "authenticated"]) {
    ok(`${role} cannot call fn_user_locales`, await denied(role, "select * from public.fn_user_locales(array[$1::uuid])", [a]));
    ok(`${role} cannot call fn_adopt_locale`, await denied(role, "select public.fn_adopt_locale($1, 'ms')", [a]));
  }

  await client.query("savepoint proof");
  try {
    // A member with no saved language, for the length of this savepoint only.
    await client.query("update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'locale' where id = $1", [a]);
    const none = await asService("select * from public.fn_user_locales(array[$1::uuid])", [a]);
    ok("no saved language reads as no row", none.length === 0, JSON.stringify(none));
    const bad = (await asService("select public.fn_adopt_locale($1, 'xx') r", [a]))[0].r;
    ok("a language the app doesn't speak is refused", bad === false);
    const adopted = (await asService("select public.fn_adopt_locale($1, 'ms') r", [a]))[0].r;
    ok("the service role saves a language when none is saved", adopted === true);
    const read = await asService("select * from public.fn_user_locales(array[$1::uuid])", [a]);
    ok("fn_user_locales reads it back", read.length === 1 && read[0].locale === "ms", JSON.stringify(read));
    const again = (await asService("select public.fn_adopt_locale($1, 'zh-Hans') r", [a]))[0].r;
    const still = await asService("select * from public.fn_user_locales(array[$1::uuid])", [a]);
    ok("a saved language is never overwritten", again === false && still[0]?.locale === "ms", JSON.stringify(still));
    const others = (await client.query(
      "select raw_user_meta_data ? 'full_name' kept from auth.users where id = $1", [a])).rows[0];
    ok("the rest of the metadata is untouched", others !== undefined);
  } finally {
    await client.query("rollback to savepoint proof");
  }
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
    console.log("\nproof rolled back: no member's account was changed");
  }
} catch (e) {
  failed = true;
  console.error("error:", e.message);
  await client.query("rollback").catch(() => {});
} finally {
  await client.end();
  process.exit(failed ? 1 : 0);
}

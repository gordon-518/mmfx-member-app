// Throwaway user for previewing signed-in pages as a Free (expired-trial) user.
//   node scripts/preview-user.mjs create   -> free-preview@mmfx.test, trial_expired
//   node scripts/preview-user.mjs delete
// Sign it in without the captcha-protected password grant: service-role
// admin.generateLink({ type: "magiclink" }) (sends no email), then
// anon.auth.verifyOtp({ token_hash }), then set the sb-<ref>-auth-token cookie.
// Uses its OWN address. Never the showcase account (SHOWCASE_DEMO_EMAIL,
// demo@mmfx.test): the showcase link signs in as that user, so deleting it
// breaks the link and destroys its seeded data.
import { readFileSync } from "node:fs";
import pg from "pg";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(raw.split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const EMAIL = "free-preview@mmfx.test";
const SHOWCASE = (env.SHOWCASE_DEMO_EMAIL ?? "demo@mmfx.test").toLowerCase();
if (EMAIL === SHOWCASE) throw new Error("refusing to touch the showcase account");
const c = new pg.Client({ host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432, user: "postgres.dldrcitoeoxzfctsqlmo", password: decodeURIComponent(new URL(env.DATABASE_URL).password), database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const del = await c.query("delete from auth.users where email = $1 returning id", [EMAIL]);
console.log(`deleted ${del.rowCount} existing ${EMAIL}`);
if (process.argv[2] === "create") {
  const id = (await c.query("select gen_random_uuid() id")).rows[0].id;
  await c.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
      crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Free Preview","roadmap_seen":true}'::jsonb, now(), now())`, [id, EMAIL]);
  await c.query(`update auth.users set confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
      email_change = coalesce(email_change,''), email_change_token_new = coalesce(email_change_token_new,''),
      email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
      phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'')
    where id = $1`, [id]);
  await c.query(`insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), $1::uuid, $2::text, 'email', jsonb_build_object('sub', $2::text, 'email', $3::text), now(), now(), now())`, [id, id, EMAIL]);
  await c.query(`update public.profiles set account_status = 'trial_expired', trial_ends_at = now() - interval '1 day',
      downgraded_at = now(), is_admin = false where id = $1`, [id]);
  console.log(`created ${EMAIL} (${id}) -> trial_expired, roadmap_seen`);
}
await c.end();

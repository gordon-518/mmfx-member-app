// Throwaway demo user for signed-in previews. Usage:
//   node scripts/demo-user.mjs setup [status]   (default member_active)
//   node scripts/demo-user.mjs delete
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pw = (env.match(/DATABASE_URL=postgresql:\/\/postgres:([^@]+)@/) || [])[1];
const password = decodeURIComponent(pw);

const client = new pg.Client({
  host: "aws-1-ap-southeast-2.pooler.supabase.com",
  port: 5432,
  user: "postgres.dldrcitoeoxzfctsqlmo",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const EMAIL = "demo@mmfx.test";
const PASS = "mmfx-demo-2026";

const mode = process.argv[2] || "setup";
const status = process.argv[3] || "member_active";

await client.connect();

if (mode === "delete") {
  await client.query(`delete from auth.users where email=$1`, [EMAIL]);
  console.log("deleted", EMAIL);
  await client.end();
  process.exit(0);
}

await client.query(`delete from auth.users where email=$1`, [EMAIL]);

const { rows } = await client.query(
  `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
   values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
     $1, crypt($2, gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Member"}', now(), now())
   returning id`,
  [EMAIL, PASS]
);
const uid = rows[0].id;

await client.query(
  `update auth.users set confirmation_token='', recovery_token='', email_change='',
     email_change_token_new='', email_change_token_current='', phone_change='',
     phone_change_token='', reauthentication_token='' where id=$1`,
  [uid]
);

await client.query(
  `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
   values ($1::text, $1::uuid, jsonb_build_object('sub',$1::text,'email',$2::text), 'email', now(), now())`,
  [uid, EMAIL]
);

await client.query(
  `update public.profiles
     set account_status=$2, trial_ends_at=now() + interval '14 days', is_admin=true
   where id=$1`,
  [uid, status]
);

console.log("created", EMAIL, "as", status, uid);
await client.end();

// Look up a member by email: account status, trial dates, TV username.
// Usage: node scripts/check-user.mjs <email>
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

const email = process.argv[2];
await client.connect();

const { rows } = await client.query(
  `select p.id, p.email, p.full_name, p.account_status, p.member_status,
          p.trial_ends_at, p.trial_count, p.tradingview_username,
          p.signup_at, p.last_activity_at, p.is_admin,
          u.created_at as auth_created, u.last_sign_in_at
     from public.profiles p
     left join auth.users u on u.id = p.id
    where lower(p.email) = lower($1)`,
  [email]
);

console.log(JSON.stringify(rows, null, 2));
await client.end();

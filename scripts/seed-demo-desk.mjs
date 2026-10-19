// Seed a white-label demo tenant so every surface has something on it.
//
//   node scripts/seed-demo-desk.mjs --env .env.demo.local [--analyses-from .env.local]
//
// Idempotent. Creates/refreshes:
//   - the demo ADMIN account (DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD from the env
//     file) so a prospect can be walked through the back office;
//   - the three most recent daily analyses copied from the source tenant named
//     by --analyses-from (title, video id, description, bias, session, cover
//     image), labelled as sample content; PDF reports are not copied;
//   - two upcoming live classes with placeholder links;
//   - thirty days of growth_daily snapshots so /stats draws a chart.
// The demo MEMBER comes from scripts/demo-user.mjs and the journal history from
// scripts/seed-journal-demo.mjs; run those first.
import { loadEnv, pgClient } from "./lib/env.mjs";

const env = loadEnv();
const fromIdx = process.argv.indexOf("--analyses-from");
const fromFile = fromIdx >= 0 ? process.argv[fromIdx + 1] : null;
const src = fromFile ? loadEnv(fromFile) : null;

const ADMIN_EMAIL = (env.DEMO_ADMIN_EMAIL || "").toLowerCase();
const ADMIN_PASS = env.DEMO_ADMIN_PASSWORD || "";
if (!ADMIN_EMAIL || !ADMIN_PASS) throw new Error("DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD must be set in the env file");

const client = pgClient(env);
await client.connect();

// ---------------------------------------------------------------- admin ----
await client.query(`delete from auth.users where email=$1`, [ADMIN_EMAIL]);
const { rows } = await client.query(
  `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
   values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
     $1, crypt($2, gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Desk Admin","roadmap_seen":true}', now(), now())
   returning id`,
  [ADMIN_EMAIL, ADMIN_PASS]
);
const adminId = rows[0].id;
await client.query(
  `update auth.users set confirmation_token='', recovery_token='', email_change='',
     email_change_token_new='', email_change_token_current='', phone_change='',
     phone_change_token='', reauthentication_token='' where id=$1`,
  [adminId]
);
await client.query(
  `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
   values ($1::text, $1::uuid, jsonb_build_object('sub',$1::text,'email',$2::text), 'email', now(), now())`,
  [adminId, ADMIN_EMAIL]
);
await client.query(
  `update public.profiles
     set account_status='member_active', trial_ends_at=null, is_admin=true,
         full_name='Desk Admin', country='SG', trading_account_number='5009999',
         deposit_amount=500, deposit_verified_at=now(), kys_completed_at=now(), kys_archetype='strategist'
   where id=$1`,
  [adminId]
);
console.log("admin", ADMIN_EMAIL, adminId);

// --------------------------------------------------------- demo member ----
// scripts/demo-user.mjs leaves the showcase member on a running trial clock,
// which resolves to the Desk-equivalent trial tier and cannot open the AI
// Trading Assistant (Team tier). A prospect must see everything, so the demo
// member is a funded Team member with the quiz already done.
const MEMBER_EMAIL = (env.SHOWCASE_DEMO_EMAIL || "").toLowerCase();
if (MEMBER_EMAIL) {
  const { rowCount } = await client.query(
    `update public.profiles
        set account_status='member_active', deposit_amount=500, deposit_verified_at=now(),
            trial_ends_at=null, kys_completed_at=now(), kys_archetype='strategist'
      where lower(email)=$1`,
    [MEMBER_EMAIL]
  );
  console.log(rowCount ? `member ${MEMBER_EMAIL} lifted to Team` : `member ${MEMBER_EMAIL} not found (run demo-user.mjs first)`);
}

// ------------------------------------------------------------- analyses ----
if (src) {
  const srcClient = pgClient(src);
  await srcClient.connect();
  const { rows: analyses } = await srcClient.query(
    `select published_on, title, gumlet_id, description, bias, session_tag, cover_path
       from public.daily_analysis where is_published order by published_on desc limit 3`
  );
  await srcClient.end();

  await client.query(`delete from public.daily_analysis`);
  for (const a of analyses) {
    let coverPath = null;
    if (a.cover_path && src.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      // Covers live in a public bucket on the source; copy the bytes across.
      const res = await fetch(`${src.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/analysis-covers/${a.cover_path}`);
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        const up = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/analysis-covers/${a.cover_path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": res.headers.get("content-type") || "image/png",
            "x-upsert": "true",
          },
          body: bytes,
        });
        if (up.ok) coverPath = a.cover_path;
        else console.warn("cover upload failed", a.cover_path, up.status, await up.text());
      }
    }
    await client.query(
      `insert into public.daily_analysis (published_on, title, gumlet_id, description, bias, session_tag, cover_path, report_path, is_published)
       values ($1, $2, $3, $4, $5, $6, $7, null, true)`,
      [a.published_on, `[Sample] ${a.title.replace(/^⚜️\s*/, "")}`, a.gumlet_id, a.description, a.bias, a.session_tag, coverPath]
    );
  }
  console.log("analyses", analyses.length, "copied from", fromFile);
}

// --------------------------------------------------------- live classes ----
await client.query(`delete from public.live_classes`);
const next = (dow, hour) => {
  const d = new Date();
  d.setUTCHours(hour - 8, 0, 0, 0); // hour is SGT
  while (d.getUTCDay() !== dow || d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};
await client.query(
  `insert into public.live_classes (starts_at, title, zoom_url) values
     ($1, 'Weekly desk review: the week ahead on gold', 'https://zoom.us/j/0000000001'),
     ($2, 'Live on the charts: managing the open position', 'https://zoom.us/j/0000000002')`,
  [next(2, 20), next(4, 20)]
);
console.log("live classes 2");

// ---------------------------------------------------------- growth rows ----
await client.query(`delete from public.growth_daily`);
let members = 140, trials = 38;
for (let i = 29; i >= 0; i--) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
  const date = d.toISOString().slice(0, 10);
  const signups = 6 + Math.round(5 * Math.abs(Math.sin(i * 1.3)));
  const conv = i % 3 === 0 ? 2 : 1;
  const churn = i % 7 === 0 ? 1 : 0;
  members += conv - churn; trials = Math.max(20, trials + signups - conv - 5);
  await client.query(
    `insert into public.growth_daily (date, signups_today, signups_7d, signups_30d, trials_active, trials_expiring_48h,
       conversions_today, members_active, churn_today, tv_engagement_pct, broker_split, members_verified, members_legacy)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [date, signups, signups * 7, signups * 28, trials, Math.round(trials / 6), conv, members, churn, 62.5,
     JSON.stringify({ dupoin: Math.round(members * 0.7), octa: Math.round(members * 0.3) }), members - 12, 12]
  );
}
console.log("growth_daily 30 rows");

await client.end();

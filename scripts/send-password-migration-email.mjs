// One-time migration email to existing pre-cutover members.
//
// Background: the app moved from magic-link auth to email+password (+ Google).
// Every account created via the old magic-link flow has a GoTrue-generated
// bcrypt hash but NO password the user knows — they only ever used magic links.
// So they can't sign in with a password until they set one. This emails each of
// them once, pointing to /forgot-password (or they can use "Sign in with
// Google"). New signups AFTER the cutover set their own password and are skipped.
//
// Recipients = auth.users created BEFORE the cutover timestamp, with no Google
// identity, excluding internal addresses. Pulled via the Supabase Management API
// SQL endpoint (SUPABASE_ACCESS_TOKEN).
//
// Usage:
//   node scripts/send-password-migration-email.mjs                    # DRY RUN, cutover = now
//   node scripts/send-password-migration-email.mjs --before=2026-06-29T10:00:00Z  # explicit cutover
//   node scripts/send-password-migration-email.mjs --send             # actually send
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");

const PROJECT_REF = "dldrcitoeoxzfctsqlmo";
const ACCESS_TOKEN = val("SUPABASE_ACCESS_TOKEN");
const SP_ID = val("SENDPULSE_API_ID");
const SP_SECRET = val("SENDPULSE_API_SECRET");

const SEND = process.argv.includes("--send");
const beforeArg = (process.argv.find((a) => a.startsWith("--before=")) || "").split("=")[1];
const CUTOVER = beforeArg || new Date().toISOString();
const SKIP = new Set(["gordon@marketmakersfx.net", "hello@marketmakersfx.net"]);

const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const SUBJECT = "Action needed: set your Market Makers FX password";
const RESET_URL = "https://app.marketmakersfx.net/forgot-password";

function emailHtml(name) {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.6">
  <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ea580c;margin:0 0 8px">Market Makers FX</p>
  <h1 style="font-size:22px;margin:0 0 16px">We've upgraded how you sign in</h1>
  <p>${hi}</p>
  <p>We've made signing in to your Market Makers FX desk simpler and more reliable. Instead of waiting for a magic link, you now sign in with an <strong>email and password</strong> — or with one tap using <strong>Google</strong>.</p>
  <p>Because your account was created before this change, please take a moment to <strong>set your password</strong> (a one-time step):</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${RESET_URL}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">Set your password →</a>
  </p>
  <p>You'll enter your email, receive a 6-digit code, and choose a password. That's it — your access and trial are unchanged.</p>
  <p style="color:#78716c;font-size:14px">Prefer Google? On the sign-in page just tap <strong>"Sign in with Google"</strong> using the same email and you're straight in — no password needed.</p>
  <p style="color:#a8a29e;font-size:13px;margin-top:24px">If you didn't expect this email, you can safely ignore it. Your account stays secure.</p>
  <p style="color:#a8a29e;font-size:13px">— The Market Makers FX team</p>
</div>`;
}

async function fetchRecipients() {
  const query = `
    select u.email, coalesce(p.full_name, '') as name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.created_at < '${CUTOVER}'
      and u.email is not null
      and u.deleted_at is null
      and not exists (
        select 1 from auth.identities i
        where i.user_id = u.id and i.provider = 'google'
      )
    order by u.created_at;`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    console.error("Management API query failed:", res.status, await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  return rows
    .map((r) => ({ email: (r.email || "").trim().toLowerCase(), name: (r.name || "").trim() }))
    .filter((r) => r.email && !SKIP.has(r.email));
}

async function sendpulseToken() {
  const r = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: SP_ID, client_secret: SP_SECRET }),
  });
  return (await r.json().catch(() => ({})))?.access_token ?? null;
}

async function sendOne(token, to) {
  const email = {
    subject: SUBJECT,
    from: FROM,
    to: [{ name: to.name || to.email, email: to.email }],
    html: Buffer.from(emailHtml(to.name), "utf8").toString("base64"),
  };
  const res = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const detail = await res.json().catch(() => ({}));
  return res.ok && detail?.result !== false;
}

// ---- main ----
const recipients = await fetchRecipients();
console.log(`Cutover (recipients created before): ${CUTOVER}`);
console.log(`Pre-cutover recipients: ${recipients.length}`);
console.log("Sample (first 5):");
for (const r of recipients.slice(0, 5)) console.log(`  ${r.email}${r.name ? `  (${r.name})` : ""}`);

if (!SEND) {
  console.log("\n--- DRY RUN — no emails sent. Re-run with --send to send. ---");
  console.log("\nFrom:", `${FROM.name} <${FROM.email}>`);
  console.log("Subject:", SUBJECT);
  console.log("\n----- rendered HTML (sample for first recipient) -----\n");
  console.log(emailHtml(recipients[0]?.name || ""));
  process.exit(0);
}

const token = await sendpulseToken();
if (!token) { console.error("SendPulse OAuth failed"); process.exit(1); }

let ok = 0, fail = 0;
for (const r of recipients) {
  const sent = await sendOne(token, r);
  if (sent) ok++; else { fail++; console.log(`  FAIL ${r.email}`); }
  await new Promise((res) => setTimeout(res, 350)); // ~10k/hr ceiling, well under 5k/hr plan
}
console.log(`\nDone. Sent ${ok}/${recipients.length} (${fail} failed).`);

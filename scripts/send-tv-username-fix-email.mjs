// One-off: email active users whose saved `tradingview_username` is NOT a valid
// TradingView handle (they entered an email, their display name, or a URL), so
// the indicator grant lands nowhere and they have no real access. These predate
// the username validation now enforced at entry. Asks them to re-enter their
// @handle in the app (which validates + auto-grants).
//
//   node scripts/send-tv-username-fix-email.mjs           # DRY RUN (no send)
//   node scripts/send-tv-username-fix-email.mjs --send     # actually send
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const URL = val("NEXT_PUBLIC_SUPABASE_URL");
const SR = val("SUPABASE_SERVICE_ROLE_KEY");
const SP_ID = val("SENDPULSE_API_ID");
const SP_SECRET = val("SENDPULSE_API_SECRET");

const SEND = process.argv.includes("--send");
const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const SUBJECT = "Quick fix needed — your MMFX indicators aren't active yet";
const UPDATE_URL = "https://app.marketmakersfx.net/indicators";

// A valid TradingView username: letters, numbers, underscores, 2–30 chars.
const VALID = /^[A-Za-z0-9_]{2,30}$/;
function classify(v) {
  if (v.includes("@")) return "an email address";
  if (/https?:|\//.test(v)) return "a link";
  if (/\s/.test(v)) return "your display name";
  return "not a valid handle";
}

function emailHtml(name, current, kind) {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.6">
  <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ea580c;margin:0 0 8px">Market Makers FX</p>
  <h1 style="font-size:22px;margin:0 0 16px">We couldn't switch on your indicators yet</h1>
  <p>${hi}</p>
  <p>We tried to activate your TradingView indicators, but the TradingView username saved on your account — <strong>${current}</strong> — isn't a valid TradingView handle (it looks like ${kind}), so the access couldn't attach.</p>
  <p>It's a 30-second fix:</p>
  <ol style="padding-left:18px">
    <li>Log in to your member area and open <strong>Indicators</strong> (or <strong>Strategies</strong>).</li>
    <li>In the "update username" box, enter your exact TradingView <strong>@username</strong> — not your email or display name.</li>
    <li>Find it on TradingView → tap your avatar (top-right) → the <strong>@name</strong> shown there.</li>
  </ol>
  <p style="text-align:center;margin:28px 0">
    <a href="${UPDATE_URL}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">Update your username →</a>
  </p>
  <p>Access is granted automatically within a few hours of saving. Just reply to this email if anything's unclear and we'll sort it with you.</p>
  <p style="color:#a8a29e;font-size:13px;margin-top:24px">— Don, Market Makers FX</p>
</div>`;
}

async function fetchRecipients() {
  // Active users with an invalid handle. Exclude member_active Ameeenzy2482
  // (already corrected manually) by only sending where the handle is STILL invalid.
  const res = await fetch(
    `${URL}/rest/v1/profiles?account_status=in.(trial_active,re_trial_active)&tradingview_username=not.is.null&select=email,full_name,tradingview_username`,
    { headers: { apikey: SR, Authorization: `Bearer ${SR}` } }
  );
  const rows = await res.json();
  return rows
    .map((r) => ({
      email: (r.email || "").trim(),
      name: (() => {
        const first = (r.full_name || "").trim().split(/\s+/)[0] || "";
        return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
      })(), // first name only, title-cased, for the greeting
      current: (r.tradingview_username || "").trim(),
    }))
    .filter((r) => r.email && r.current && !VALID.test(r.current));
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
    html: Buffer.from(emailHtml(to.name, to.current, classify(to.current)), "utf8").toString("base64"),
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
console.log(`Recipients (active, invalid TradingView handle): ${recipients.length}\n`);
for (const r of recipients) {
  console.log(`  ${r.email.padEnd(34)} name=${(r.name || "—").padEnd(16)} handle=${JSON.stringify(r.current)} → ${classify(r.current)}`);
}

if (!SEND) {
  console.log("\n--- DRY RUN — no emails sent. Re-run with --send to send. ---");
  console.log(`\nFrom: ${FROM.name} <${FROM.email}>\nSubject: ${SUBJECT}`);
  console.log("\n----- rendered HTML (first recipient) -----\n");
  console.log(emailHtml(recipients[0]?.name || "", recipients[0]?.current || "", classify(recipients[0]?.current || "")));
  process.exit(0);
}

const token = await sendpulseToken();
if (!token) { console.error("SendPulse OAuth failed"); process.exit(1); }
let ok = 0, fail = 0;
for (const r of recipients) {
  const sent = await sendOne(token, r);
  console.log(`  ${sent ? "✓ sent " : "✗ FAIL "} ${r.email}`);
  sent ? ok++ : fail++;
  await new Promise((res) => setTimeout(res, 400));
}
console.log(`\nDone: ${ok} sent, ${fail} failed.`);

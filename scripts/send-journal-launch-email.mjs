// One-off launch email: the AI Trading Assistant is live for members.
//
// Audience: member_active only (the feature is members-only). Test/demo
// accounts are skipped explicitly.
//
//   node scripts/send-journal-launch-email.mjs           # DRY RUN (no send)
//   node scripts/send-journal-launch-email.mjs --send     # actually send
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const URL = val("NEXT_PUBLIC_SUPABASE_URL");
const SR = val("SUPABASE_SERVICE_ROLE_KEY");
const SP_ID = val("SENDPULSE_API_ID");
const SP_SECRET = val("SENDPULSE_API_SECRET");

const SEND = process.argv.includes("--send");
const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const SUBJECT = "Your AI Trading Assistant is live";
const APP_URL = "https://app.marketmakersfx.net/journal";

// Never mail the showcase/demo or internal test accounts.
const SKIP = new Set(["demo@mmfx.test", "hello@marketmakersfx.net"]);

function emailHtml(name) {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;color:#1a1714;line-height:1.6">
  <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ff5a1f;margin:0 0 8px">Market Makers FX · Members</p>
  <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">Your AI Trading Assistant is live</h1>

  <p>${hi}</p>

  <p>Most traders don't lose because they can't read a chart. They lose because nobody's keeping score.</p>

  <p>So we built something that does — and it's now in your member area.</p>

  <p>Connect your MT5 account once and it pulls in every trade you've made. From there it works in the background:</p>

  <ul style="padding-left:18px;margin:16px 0">
    <li style="margin-bottom:7px"><strong>Your real numbers</strong> — win rate, profit factor, drawdown, what you actually make per trade</li>
    <li style="margin-bottom:7px"><strong>Where your money leaks</strong> — revenge trading, oversized losses, overtrading days</li>
    <li style="margin-bottom:7px"><strong>Your discipline score</strong> — how often you actually stick to your own rules</li>
    <li style="margin-bottom:7px"><strong>Don's read</strong> — an AI coach that reviews your trades against your goals and tells you straight what to fix</li>
  </ul>

  <p>No spreadsheets. No manual logging. It updates itself.</p>

  <p style="text-align:center;margin:30px 0">
    <a href="${APP_URL}" style="display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;font-weight:600;padding:14px 30px;border-radius:12px">Open your AI Trading Assistant →</a>
  </p>

  <div style="background:#fbfaf8;border:1px solid #ece7e0;border-radius:12px;padding:16px 18px;margin:24px 0">
    <p style="margin:0 0 10px;font-weight:600;font-size:15px">Before you connect — two things</p>
    <p style="margin:0 0 9px;font-size:14px"><strong>1. Use your investor password.</strong> That's the read-only one from MT5 — not your main password. We can never place trades or withdraw, and your password is never stored.</p>
    <p style="margin:0;font-size:14px"><strong>2. Save your trading account number</strong> in your profile first — the assistant uses it to find your account.</p>
  </div>

  <p style="color:#79716a;font-size:14px">Any trouble connecting, just reply to this email and we'll walk you through it.</p>

  <p style="color:#79716a;font-size:14px;margin-top:22px">— Don, Market Makers FX</p>
</div>`;
}

async function fetchRecipients() {
  const res = await fetch(
    `${URL}/rest/v1/profiles?account_status=eq.member_active&select=email,full_name`,
    { headers: { apikey: SR, Authorization: `Bearer ${SR}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
  return rows
    .map((r) => ({
      email: (r.email || "").trim(),
      name: (() => {
        const full = (r.full_name || "").trim();
        // Some profiles have an email (or junk) in full_name — never greet with it.
        if (!full || full.includes("@")) return "";
        const first = full.split(/\s+/)[0] || "";
        if (first.length < 2) return ""; // single-letter initials read oddly
        // Leave non-Latin names (e.g. CJK) untouched; title-case Latin ones.
        if (!/^[A-Za-z]/.test(first)) return first;
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      })(),
    }))
    .filter((r) => r.email && !SKIP.has(r.email.toLowerCase()));
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
console.log(`Recipients (member_active, excl. demo/internal): ${recipients.length}\n`);
for (const r of recipients) console.log(`  ${r.email.padEnd(38)} ${r.name || "—"}`);

if (!SEND) {
  console.log("\n--- DRY RUN — no emails sent. Re-run with --send to send. ---");
  console.log(`\nFrom: ${FROM.name} <${FROM.email}>\nSubject: ${SUBJECT}`);
  console.log("\n----- rendered HTML (first recipient) -----\n");
  console.log(emailHtml(recipients[0]?.name || ""));
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

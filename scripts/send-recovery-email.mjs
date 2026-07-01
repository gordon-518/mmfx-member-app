// One-off: notify the 49 recently-created accounts that were deleted and
// restored (2026-07-01 incident) that they need to set a password to sign back
// in. Recipients = scratchpad/recover_list.json minus non-genuine test accounts.
//
// Usage: node scripts/send-recovery-email.mjs [--send]   (dry run by default)
import fs from "node:fs";
const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const SPID = val("SENDPULSE_API_ID"), SPSEC = val("SENDPULSE_API_SECRET");
const SEND = process.argv.includes("--send");
const LIST = process.argv.find(a => a.startsWith("--list="))?.split("=")[1]
  || "/private/tmp/claude-501/-Users-gordon-Documents-Claude-mmfx-member-app/4b37c36e-f52e-4f8d-8260-feba2b7d698c/scratchpad/recover_list.json";

const EXCLUDE = new Set(["cookietest-74555@gmail.com", "gordongoh30@gmail.com", "demo@mmfx.test"]);
const recipients = JSON.parse(fs.readFileSync(LIST, "utf8")).filter(c => !EXCLUDE.has(c.email));

const FROM = { name: "Market Makers FX", email: "hello@marketmakersfx.net" };
const SUBJECT = "Action needed: sign back in to Market Makers FX";
const URL = "https://app.marketmakersfx.net/forgot-password";

function html(name) {
  const hi = name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.6">
  <p style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#ea580c;margin:0 0 8px">Market Makers FX</p>
  <h1 style="font-size:22px;margin:0 0 16px">Quick step to get back in</h1>
  <p>${hi}</p>
  <p>We hit a brief technical issue on our end that affected a batch of recently-created accounts, including yours. Your access has been restored — you just need to set a password to sign back in (a one-time step).</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${URL}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">Set your password &rarr;</a>
  </p>
  <p>Enter your email, we'll send a 6-digit code, and you choose a password. Prefer Google? Just tap <strong>"Sign in with Google"</strong> with the same email.</p>
  <p style="color:#78716c;font-size:14px">Your 14-day trial is active and everything on your desk is open. Sorry for the hiccup — thanks for bearing with us.</p>
  <p style="color:#a8a29e;font-size:13px;margin-top:20px">— The Market Makers FX team</p>
</div>`;
}

console.log(`Recipients: ${recipients.length}`);
recipients.slice(0, 5).forEach(r => console.log(`  ${r.email}${r.name ? "  ("+r.name+")" : ""}`));

if (!SEND) {
  console.log("\n--- DRY RUN — nothing sent. Add --send to send. ---");
  console.log("From:", `${FROM.name} <${FROM.email}>`);
  console.log("Subject:", SUBJECT);
  console.log("\n" + html("Gaurav"));
  process.exit(0);
}

const token = await fetch("https://api.sendpulse.com/oauth/access_token", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id: SPID, client_secret: SPSEC }),
}).then(r => r.json()).then(j => j.access_token);
if (!token) { console.error("SendPulse OAuth failed"); process.exit(1); }

let ok = 0, fail = 0;
for (const r of recipients) {
  const email = { subject: SUBJECT, from: FROM, to: [{ name: r.name || r.email, email: r.email }],
    html: Buffer.from(html(r.name), "utf8").toString("base64") };
  const res = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const d = await res.json().catch(() => ({}));
  if (res.ok && d?.result !== false) ok++; else { fail++; console.log("  FAIL", r.email); }
  await new Promise(res => setTimeout(res, 300));
}
console.log(`\nDone. Sent ${ok}/${recipients.length} (${fail} failed).`);

// One-time batch sync of migrated Softr members into the SendPulse
// "MMFX Signups" address book. The per-signup DB trigger is async (pg_net) and
// can't keep up with a 108-row burst, so this adds them directly in batches.
//
// Usage: node scripts/sendpulse-sync-migrated.mjs scripts/softr-users.csv
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const ID = val("SENDPULSE_API_ID");
const SECRET = val("SENDPULSE_API_SECRET");
const BOOK = val("SENDPULSE_BOOK_ID") || "704360";
const CSV = process.argv[2] || "scripts/softr-users.csv";

function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const SKIP = new Set(["gordon@marketmakersfx.net", "hello@marketmakersfx.net"]);
const rows = parseCsv(fs.readFileSync(CSV, "utf8")).filter((r) => r.length > 1 && r.some((c) => c.trim()));
const header = rows.shift().map((h) => h.trim());
const iE = header.indexOf("Email"), iN = header.indexOf("Name"), iR = header.indexOf("Role");
const seen = new Set(), USERS = [];
for (const r of rows) {
  const email = (r[iE] || "").trim().toLowerCase();
  const name = (r[iN] || "").trim();
  if (!email || (r[iR] || "").trim() !== "Mentorship" || SKIP.has(email) || seen.has(email)) continue;
  seen.add(email); USERS.push({ email, variables: { Name: name } });
}
console.log(`Parsed ${USERS.length} members to sync into SendPulse book ${BOOK}`);

const token = await fetch("https://api.sendpulse.com/oauth/access_token", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id: ID, client_secret: SECRET }),
}).then((r) => r.json()).then((j) => j.access_token);
if (!token) { console.error("OAuth failed"); process.exit(1); }

let added = 0;
const CHUNK = 50;
for (let i = 0; i < USERS.length; i += CHUNK) {
  const batch = USERS.slice(i, i + CHUNK);
  const res = await fetch(`https://api.sendpulse.com/addressbooks/${BOOK}/emails`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emails: batch }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`  batch ${i / CHUNK + 1}: HTTP ${res.status} result=${JSON.stringify(j).slice(0, 80)}`);
  if (j.result === true || res.ok) added += batch.length;
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`\nDone. Submitted ${added}/${USERS.length}.`);

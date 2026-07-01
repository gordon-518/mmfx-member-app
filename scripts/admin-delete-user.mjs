// Safe admin user deletion. USE THIS — never delete via the admin
// `GET /auth/v1/admin/users?email=` endpoint: that "filter" is IGNORED and
// returns the first 50 users, so looping a delete over it wipes 50 real
// accounts (this happened 2026-07-01; 49 trials were deleted and recovered).
//
// This tool resolves the id via a Management API SQL query (which genuinely
// filters), REFUSES unless exactly one account matches, prints the single
// target, and deletes only that specific id — and only with --confirm.
//
// Usage:
//   node scripts/admin-delete-user.mjs someone@example.com            # dry run (shows target, deletes nothing)
//   node scripts/admin-delete-user.mjs someone@example.com --confirm  # delete that one account
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const REF = "dldrcitoeoxzfctsqlmo";
const TOK = val("SUPABASE_ACCESS_TOKEN");
const URL = val("NEXT_PUBLIC_SUPABASE_URL");
const SR = val("SUPABASE_SERVICE_ROLE_KEY");

const email = (process.argv[2] || "").trim().toLowerCase();
const confirm = process.argv.includes("--confirm");

if (!email || email.startsWith("--")) {
  console.error("Usage: node scripts/admin-delete-user.mjs <email> [--confirm]");
  process.exit(1);
}

// Resolve via SQL — the ONLY reliable way to match by email.
const rows = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `select u.id, u.email, p.account_status
            from auth.users u
            left join public.profiles p on p.id = u.id
            where lower(u.email) = '${email.replace(/'/g, "''")}' and u.deleted_at is null`,
  }),
}).then((r) => r.json());

if (!Array.isArray(rows)) {
  console.error("Lookup failed:", JSON.stringify(rows).slice(0, 300));
  process.exit(1);
}

// HARD GUARD: refuse on anything other than exactly one match.
if (rows.length === 0) {
  console.log(`No account matches ${email}. Nothing to delete.`);
  process.exit(0);
}
if (rows.length > 1) {
  console.error(`REFUSING: ${rows.length} accounts matched ${email} (expected exactly 1).`);
  process.exit(1);
}

const target = rows[0];
console.log("Exactly one match:");
console.log(`  id:     ${target.id}`);
console.log(`  email:  ${target.email}`);
console.log(`  status: ${target.account_status ?? "(no profile)"}`);

if (!confirm) {
  console.log("\nDRY RUN — nothing deleted. Re-run with --confirm to delete this ONE account.");
  process.exit(0);
}

if (target.account_status === "member_active") {
  console.error("\nREFUSING: target is member_active (a paying member). Delete manually if truly intended.");
  process.exit(1);
}

const res = await fetch(`${URL}/auth/v1/admin/users/${target.id}`, {
  method: "DELETE",
  headers: { apikey: SR, Authorization: `Bearer ${SR}` },
});
console.log(res.ok ? `\nDeleted ${target.email} (${target.id}).` : `\nDelete failed: HTTP ${res.status}`);
process.exit(res.ok ? 0 : 1);

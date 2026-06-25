// ============================================================================
// One-time Softr → Supabase user migration (CSV-driven)
//
// Reads the Softr "Users" CSV export, keeps Role=Mentorship rows, dedupes by
// email, and creates each as a CONFIRMED magic-link Supabase user
// (email_confirm: true → no password, NO confirmation/magic-link email sent)
// then flips their profile to member_active.
//
// Dry run (no DB writes, no service key needed — review the list first):
//   DRY_RUN=1 node scripts/migrate-softr-users.mjs "/Users/gordon/Downloads/Users (1).csv"
//
// Real run:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate-softr-users.mjs "/Users/gordon/Downloads/Users (1).csv"
//   (service_role key: Supabase Dashboard → Settings → API → service_role)
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const SUPABASE_URL = 'https://dldrcitoeoxzfctsqlmo.supabase.co'
const CSV_PATH = process.argv[2] || '/Users/gordon/Downloads/Users (1).csv'
const DRY_RUN = !!process.env.DRY_RUN
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Admin / system accounts that must NOT be migrated as members.
const SKIP_EMAILS = new Set(['gordon@marketmakersfx.net', 'hello@marketmakersfx.net'])

// ── Minimal RFC-4180 CSV parser (handles "quoted, fields" + escaped quotes) ──
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const raw = fs.readFileSync(CSV_PATH, 'utf8')
const rows = parseCsv(raw).filter((r) => r.length > 1 && r.some((c) => c.trim()))
const header = rows.shift().map((h) => h.trim())
const col = (name) => header.indexOf(name)
const iEmail = col('Email'), iName = col('Name'), iRole = col('Role')

const seen = new Set()
const USERS = []
const dupes = []
for (const r of rows) {
  const email = (r[iEmail] || '').trim().toLowerCase()
  const name = (r[iName] || '').trim()
  const role = (r[iRole] || '').trim()
  if (!email || role !== 'Mentorship' || SKIP_EMAILS.has(email)) continue
  if (seen.has(email)) { dupes.push(email); continue }
  seen.add(email)
  USERS.push({ email, name })
}

console.log(`CSV: ${CSV_PATH}`)
console.log(`Mentorship users after dedup: ${USERS.length}  (skipped ${dupes.length} duplicate rows)\n`)

if (DRY_RUN) {
  USERS.forEach((u, i) => console.log(`${String(i + 1).padStart(3)}. ${u.email.padEnd(40)} ${u.name}`))
  console.log(`\nDuplicate emails collapsed: ${[...new Set(dupes)].join(', ') || '(none)'}`)
  console.log(`\n[DRY RUN] No accounts created. Re-run with SUPABASE_SERVICE_ROLE_KEY set to execute.`)
  process.exit(0)
}

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required for a real run.')
  console.error('  (or set DRY_RUN=1 to preview without it)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`Migrating ${USERS.length} Softr members to Supabase...\n`)

  // Pre-fetch existing auth users so we don't hit "already registered" errors.
  const existingByEmail = {}
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) console.warn('Warning: could not pre-fetch existing users:', listErr.message)
  else {
    for (const u of existing.users) if (u.email) existingByEmail[u.email.toLowerCase()] = u.id
    console.log(`${Object.keys(existingByEmail).length} existing auth users found\n`)
  }

  let created = 0, updated = 0, errors = 0
  const failed = []

  for (const { email, name } of USERS) {
    let userId = existingByEmail[email]

    if (userId) {
      process.stdout.write(`EXIST  ${email}\n`)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      })
      if (error) {
        console.error(`ERR    ${email}: ${error.message}`)
        errors++; failed.push({ email, reason: error.message }); continue
      }
      userId = data.user.id
      created++
      process.stdout.write(`NEW    ${email}\n`)
    }

    // Flip to member_active — the handle_new_user trigger already created the row.
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ account_status: 'member_active', member_status: 'active', full_name: name })
      .eq('id', userId)
    if (profErr) {
      console.error(`PROF   ${email}: ${profErr.message}`)
      errors++; failed.push({ email, reason: `profile update: ${profErr.message}` })
    } else updated++

    await sleep(150) // gentle throttle
  }

  console.log(`\nDone. created=${created} profilesUpdated=${updated} errors=${errors}`)
  if (failed.length) console.log('Failed:\n' + failed.map((f) => `  ${f.email}: ${f.reason}`).join('\n'))
}

main().catch((e) => { console.error(e); process.exit(1) })

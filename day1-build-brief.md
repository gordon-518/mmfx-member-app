# MMFX Member App — Day 1 Build Brief

**For:** Claude Code, building a **new, standalone Next.js project** for the MMFX member app.
**Scope of this brief:** Day 1 only — scaffold, schema design, Supabase wiring, dashboard stub. Nothing else.

---

## Read this first

This is a **brand-new Next.js project**, separate from the existing `mmfx-site` marketing site (which is Astro and stays as-is). Do NOT try to extend or import the Astro site. This member app is its own project, its own repo.

**Order is locked. Do not skip ahead.** Scaffold → SCHEMA.md (reviewed + approved) → Supabase wiring → dashboard stub. SCHEMA.md must be approved before any database or auth code is written. Auth is tomorrow's task and depends on the schema — do not build auth today.

After each task, stop and report what changed before moving to the next.

---

## What we're building (context)

MMFX is an education-first trading academy. Users sign up free → get a **14-day full-access trial** → either deposit **$500 to a partnered broker** to become a member, or auto-downgrade. Revenue is broker IB (Introducing Broker) commissions on lots those traders execute. The schema you design today is the foundation the trial state machine (tomorrow) and content gating (Week 2) sit on. Schema churn later costs days — get it right.

---

## Tech stack (locked)

- **Framework:** Next.js (App Router) + TypeScript, deployed on Vercel — NEW project
- **Auth + DB:** Supabase
- **Styling:** Tailwind CSS
- **Email:** Resend (not today)
- **Video:** Gumlet (not today)
- **eBooks:** Cloudflare R2 signed URLs (not today)
- **Analytics:** Meta CAPI server-side (not today)

---

## Today's tasks — in this exact order

### 0. Scaffold the Next.js project
- Create a new Next.js app in this folder: App Router, TypeScript, Tailwind, ESLint.
- Confirm it runs locally (`npm run dev`) and report the Next.js version installed.
- Initialize git. Stop and report before continuing.

### 1. `SCHEMA.md` — before any database code
Write `docs/SCHEMA.md` describing the database schema. No SQL execution, no migrations yet — just the documented design, for human review. It must encode the state machine and fields below. **Stop after this and wait for approval.**

### 2. Wire Supabase (only after schema approved)
- Install and initialize the Supabase client in the Next.js app.
- Set up env via `.env.example` + `.env.local`.
- **Make it connect. No tables, no auth, no RLS yet.**
- You write `.env.example` and the client code. The human fills real keys into `.env.local` and Vercel — never put real secrets in code or commits.

### 3. Stub `/app/dashboard`
- A deployable shell page at `app/dashboard/page.tsx` so there's something to build onto tomorrow.
- Minimal: renders, deploys clean. No data, no auth gate yet.

---

## The state machine (locked — encode this in SCHEMA.md)

**States:**
- `trial_active` — signed up, within 14 days, no deposit. Full access.
- `trial_expired` — 14 days passed, never deposited. Downgraded access.
- `member_active` — verified $500 deposit. Full access.
- `re_trial_active` — the one allowed re-trial (60+ days dormant). Full access.
- `re_trial_expired` — re-trial used and lapsed. Downgraded, no further trials.

A mid-trial deposit transitions `trial_active → member_active` early. Do **not** add a separate state for it.

**Two business rules the schema MUST encode:**

1. **Membership is permanent access at launch (Option A)** — but the schema must carry `member_status` (`active` / `inactive`) and `last_known_trading_activity` so it can later be flipped to activity-gated membership *without a migration*. Build the fields now even though we don't enforce activity-gating yet.

2. **A qualifying deposit is strict:** verified **$500**, to **our** partnered broker, attributed to **our** IB link. IB attribution is a first-class field separate from deposit amount. A $500 deposit not attributed to our IB link does NOT qualify.

**Required fields (beyond the obvious id/email/timestamps):**
- `trial_ends_at` — **stored** timestamp, set at signup to `signup_at + 14 days`. Do NOT compute it on the fly.
- `deposit_verified_at`
- `deposit_verified_by` — enum: `manual` | `broker_postback` | `webhook` (launch = `manual`)
- `broker` — enum: `octa` | `dupoin`
- `deposit_amount`
- `ib_link_confirmed` — boolean, separate from `deposit_amount`
- `member_status` — enum: `active` | `inactive`
- `last_known_trading_activity` — timestamp, nullable
- `trial_count` — integer, lifetime cap of 2 (initial trial + one re-trial)
- `last_activity_at`
- `downgraded_at`

**Re-trial eligibility is COMPUTED, never a stored flag:**
`eligible = (now - downgraded_at >= 60 days) AND (trial_count < 2)`

---

## Content gating (note for schema, build in Week 2)
Access resolves to "what can this user see right now." Decide now: **tier-based access** (state → access level) rather than per-asset entitlements, unless there's a reason not to. The 8 lead magnets all unlock on signup during trial/membership and lock on downgrade. Schema should make "current access level" cleanly derivable from state.

---

## Do NOT touch today
- Magic-link auth (tomorrow — depends on approved schema)
- The Astro marketing site (`mmfx-site`) — leave it alone
- AI bots (Know Your Style, Fundamental Analysis Bot)
- Email / Resend, Gumlet, R2, Meta CAPI

---

## Hard constraints (never violate)
- Geo: USA + UK excluded from broker funnels (not relevant to today's code, but don't hardcode them in)
- Language: "$500 is a **deposit**, not a payment." Trader owns the capital. Use this framing in any user-facing copy.
- Compliance: no guaranteed-return claims anywhere.

---

## Working style
- Deliver **full, copy-paste-ready files**. Never "edit line 12 to say X."
- After each task, stop and report what changed before moving to the next.
- Schema first, approval, then code. Resist rushing the schema to "get to the real coding" — schema is the load-bearing decision of the week.

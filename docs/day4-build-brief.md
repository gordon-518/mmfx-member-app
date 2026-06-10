# MMFX Member App — Day 4 Build Brief (Admin: Deposit Verification + Re-trial)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** An admin can, from a gated page, (a) mark a qualifying deposit and flip a user to `member_active`, and (b) grant a re-trial to an eligible expired user. All rules enforced in the database, not the UI.

This is admin tooling — a human with elevated power writing to other users' rows. Build the privilege model carefully.

---

## Locked posture (do not redesign)

- **No `service_role` key in the app.** All admin writes go through `SECURITY DEFINER` functions that first check the caller is an admin, then enforce the rules. Same principle as Day 3's lazy-expiry function.
- **Rules are enforced in the functions, never trusted from the UI.** The qualifying-deposit test ($500 + partnered broker + IB-confirmed) and re-trial eligibility live in SQL. The UI is just a convenience layer.
- **Re-trial has NO admin override.** Policy is one re-trial after 60+ days dormancy, no individual exceptions. The function must reject an ineligible grant even when the caller is an admin. Do not add a force/override flag.
- Reuse the existing theme. No new design system. Keep the admin page ugly and functional.

## Out of scope today (do NOT build)
- Content gating UI / locked-content redirects (separate day).
- The proactive expiry cron (Week 3).
- Bulk actions, search, pagination, audit logs — single simple table is enough for now.
- Broker postback / webhook deposit automation — deposits are `manual` today.

---

## Key facts from the locked schema (`docs/SCHEMA.md`)
- A qualifying deposit = `deposit_amount >= 500` AND `broker in ('octa','dupoin')` AND `ib_link_confirmed = true`. On verify, set `deposit_verified_by = 'manual'` (admin action).
- Deposit can flip ANY non-member state → `member_active` (a lapsed `trial_expired`/`re_trial_expired` user who finally deposits becomes a member). Also sets `member_status = 'active'`.
- Re-trial: ONLY from `trial_expired`. Eligibility = `now() - downgraded_at >= interval '60 days'` AND `trial_count < 2`. On grant: `account_status = 're_trial_active'`, `trial_count = 2`, `trial_ends_at = now() + interval '14 days'`, `downgraded_at = null`. `re_trial_expired` is terminal — never grant from it.

---

## The five tasks — in this exact order. Stop and report after each.

### Task 1 — Migration: admin flag, `is_admin()` helper, admin read policy
New migration (fresh timestamp):
- Add column `is_admin boolean not null default false` to `public.profiles`.
- Create `SECURITY DEFINER` function `public.is_admin()` returning boolean: true if the row for `auth.uid()` has `is_admin = true`. Must be `SECURITY DEFINER` + `set search_path = ''` so it reads `profiles` WITHOUT triggering RLS recursion. Grant execute to `authenticated`.
- Add an admin SELECT policy on `profiles`: `for select to authenticated using ( public.is_admin() )`. (This is OR'd with the existing select-own policy — admins see all rows, everyone else still sees only their own.)
- Do NOT set anyone as admin in the migration. Output the SQL and stop.

### Task 2 — `fn_verify_deposit` (admin-only, rule-enforced)
`SECURITY DEFINER`, `set search_path = ''`. Signature:
`fn_verify_deposit(target_user_id uuid, p_broker text, p_amount numeric, p_ib_confirmed boolean) returns public.profiles`
- Raise if `not public.is_admin()` (caller must be admin).
- Reject (raise with a clear message) if `p_amount < 500`, or `p_broker not in ('octa','dupoin')`, or `p_ib_confirmed is not true`.
- Reject if the target is already `member_active` (clear message — nothing to do).
- On success, update the target row: `account_status = 'member_active'`, `member_status = 'active'`, `broker = p_broker`, `deposit_amount = p_amount`, `ib_link_confirmed = true`, `deposit_verified_at = now()`, `deposit_verified_by = 'manual'`. Return the updated row.
- `revoke execute from public; grant execute to authenticated;`

### Task 3 — `fn_grant_retrial` (admin-only, eligibility-enforced, NO override)
`SECURITY DEFINER`, `set search_path = ''`. Signature:
`fn_grant_retrial(target_user_id uuid) returns public.profiles`
- Raise if `not public.is_admin()`.
- Reject unless the target is currently `trial_expired`.
- Reject unless `now() - downgraded_at >= interval '60 days'` AND `trial_count < 2`. (No override path. An admin cannot bypass this.)
- On success: `account_status = 're_trial_active'`, `trial_count = 2`, `trial_ends_at = now() + interval '14 days'`, `downgraded_at = null`. Return the updated row.
- `revoke execute from public; grant execute to authenticated;`

### Task 4 — Pure helper + tests for re-trial eligibility (UI convenience only)
`src/lib/trial/admin.ts`: a pure function `canGrantRetrial(profile, now?)` returning boolean — true iff `account_status === 'trial_expired'` AND `downgraded_at` set AND `now - downgraded_at >= 60 days` AND `trial_count < 2`. This drives whether the UI shows/enables the re-trial button. **It is NOT the gate — `fn_grant_retrial` is.** Add Vitest cases: eligible, exactly-60-days boundary, under-60-days, `trial_count` already 2, wrong state.

### Task 5 — Gated admin page
`src/app/admin/page.tsx` (server component):
- `getUser()`; then check admin via the caller's own profile (`is_admin`) or `is_admin()` rpc. If not signed in OR not admin → render a plain "Not authorized" message, fetch NO user data, and do not expose any actions. (No redirect needed; just don't render the admin UI.)
- If admin: list all profiles in a simple table — email, `account_status`, `trial_count`, `trial_ends_at`, `downgraded_at`, deposit fields.
- Per row, two actions via **server actions**:
  1. **Mark deposit** — a small form: broker (select: octa/dupoin), amount (number), IB-confirmed (checkbox) → calls `fn_verify_deposit`. Surface the function's rejection messages inline (e.g. "below $500", "IB not confirmed").
  2. **Grant re-trial** — a button, shown/enabled only when `canGrantRetrial` is true → calls `fn_grant_retrial`. Surface rejection messages.
- After either action, revalidate so the table reflects the new state.
- Reuse the existing theme. Minimal, functional.

---

## Applying + becoming admin (GORDON, after review)
1. Review the SQL, then `supabase db push` (or paste migrations into the SQL Editor in timestamp order).
2. Make yourself admin once, in the SQL Editor:
   `update public.profiles set is_admin = true where email = 'gordon@marketmakersfx.net';`
   (Repeat for your support person's email when ready.)

---

## End-to-end verification (the day is done when this passes)
1. As your admin account, open `/admin` → you see the full user table. As a non-admin (or signed out), `/admin` shows "Not authorized" and no data.
2. **Deposit happy path:** pick a `trial_active` or `trial_expired` test user, mark a deposit of 500 / octa / IB-confirmed → flips to `member_active`, `member_status = active`, deposit fields set.
3. **Deposit rejections:** try amount 300 → rejected; try IB-confirmed unchecked → rejected; the user's state does NOT change.
4. **Re-trial happy path:** take a `trial_expired` user, set their `downgraded_at` to 61 days ago in the SQL Editor, click Grant re-trial → flips to `re_trial_active`, `trial_count = 2`, fresh 14-day clock, `downgraded_at` cleared.
5. **Re-trial rejections:** a user downgraded 30 days ago → button hidden/disabled, and even a forced call is rejected by the function; a `trial_count = 2` user → rejected.
6. RLS sanity: a normal (non-admin) user still sees only their own row.

Commit message: `Day 4: admin tooling — is_admin, deposit verification, re-trial granting, gated admin page`.

---

## Working style
- Full, copy-paste-ready files and SQL. Never "edit line X".
- Stop and report after each task.
- If verification passes, STOP.

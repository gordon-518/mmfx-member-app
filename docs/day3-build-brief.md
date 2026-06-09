# MMFX Member App — Day 3 Build Brief (Trial State Machine — the spine)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** The automatic trial spine works: a new signup gets a `profiles` row in `trial_active` with a 14-day clock; when the clock passes, the next time that user is seen they lazily flip to `trial_expired` and lose full access. Dashboard shows their real status.

This is the #1-risk item of the week. Build it carefully, in order, and verify each step.

---

## Decisions already locked (do not redesign)

- **Lazy expiry, not cron.** No scheduled job today. The transition fires *on read* (next time the user is seen past `trial_ends_at`). A proactive cron comes later (Week 3) when email nurture needs it.
- **RLS on.** A user can read ONLY their own profile row. No user can read anyone else's.
- **No `service_role` key in the app.** The lazy-expiry write is done by a Postgres `SECURITY DEFINER` function scoped to the calling user's own row — NOT by elevated app credentials. Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` or the app.
- Schema is `docs/SCHEMA.md` — this builds it for real. Honor every field, constraint, and the time-check guard.

## Out of scope today (Day 4+, do NOT build)
- Deposit → `member_active` transition (needs an admin verification surface — Day 4).
- Re-trial granting (`trial_expired` → `re_trial_active`) — Day 4+.
- The proactive expiry cron — Week 3.
- Any styling beyond reusing the existing theme. Do NOT re-open the font/brand question.
- Content gating UI, curriculum, the 8 lead magnets.

---

## The five tasks — in this exact order. Stop and report after each.

### Task 1 — Migration: create the `profiles` table
Write a migration at `supabase/migrations/<timestamp>_profiles.sql` that creates `profiles` exactly per `docs/SCHEMA.md`: all columns, defaults, NOT NULL where specified, and the CHECK constraints (`account_status`, `member_status`, `broker`, `deposit_verified_by`, `trial_count >= 1 AND <= 2`). Include an `updated_at` trigger that sets `updated_at = now()` on every update.
- Do NOT apply it yet. Output the SQL and stop so it can be reviewed.

### Task 2 — Auto-create profile on signup (`handle_new_user`)
Add to the migration (or a second migration) a `SECURITY DEFINER` function `handle_new_user()` plus a trigger on `auth.users` AFTER INSERT that creates the matching `profiles` row with:
- `id` = new user id, `email` = new user email
- `signup_at` = now(), `trial_ends_at` = now() + interval '14 days'
- `trial_count` = 1, `account_status` = 'trial_active', `member_status` = 'inactive'

### Task 3 — RLS policies
Enable RLS on `profiles`. Add policies:
- **SELECT:** a user can read a row only where `auth.uid() = id`.
- **No user UPDATE/INSERT/DELETE policies** on status/deposit fields — those are not user-writable. (Profile creation is the trigger; status changes are the function in Task 4.) If a user-editable field like `full_name` is wanted, add a narrow UPDATE policy for that column only — otherwise no write policies at all today.

### Task 4 — Lazy-expiry function (`SECURITY DEFINER`, own-row only)
Write a Postgres function `fn_resolve_trial_status()` that, for the **calling user** (`auth.uid()`):
- If `account_status` is `trial_active` or `re_trial_active` AND `now() > trial_ends_at`:
  - set `account_status` = `trial_expired` (if it was `trial_active`) or `re_trial_expired` (if it was `re_trial_active`)
  - set `downgraded_at` = now()
- Otherwise do nothing.
- Returns the (possibly updated) profile row.
- It must only ever act on the caller's own row. Grant EXECUTE to `authenticated`.

This is the lazy transition. It is the ONLY thing that writes `account_status` for expiry, and it sets `downgraded_at` (which re-trial eligibility later depends on).

### Task 5 — Dashboard reads + shows real trial state
Update `src/app/dashboard/page.tsx` (server component) to, for the signed-in user:
1. Call `supabase.rpc('fn_resolve_trial_status')` first (this lazily expires them if due), then read the returned/refreshed profile.
2. Display: `account_status`, days remaining in trial (computed from `trial_ends_at`, floored at 0), and access tier (**Full** vs **Limited**) derived from status WITH the time-check guard (`trial_active`/`re_trial_active` count as Full only if `now() < trial_ends_at`).
3. Keep "Not signed in → message + link to /login, no redirect" behavior. Reuse the existing theme; no new design work.

Put the access-tier / days-remaining logic in a small tested helper (e.g. `src/lib/trial/status.ts`) so it's not inline in the page.

---

## Applying the migration (GORDON, after review)
After the SQL is reviewed:
- `supabase db push` (it will prompt for your DB password — the rotated one). 
- If push gives trouble, fall back to pasting the migration SQL into the Supabase dashboard → SQL Editor and running it there.

---

## End-to-end verification (the day is done when this passes)
1. Apply the migration. Confirm `profiles` exists with the constraints.
2. Sign up a fresh test user via `/login`. Confirm a `profiles` row was auto-created: `account_status = trial_active`, `trial_count = 1`, `trial_ends_at` ≈ now + 14 days.
3. Load `/dashboard` — shows `trial_active`, ~14 days remaining, **Full** access.
4. In the SQL Editor, manually set that user's `trial_ends_at` to a past date.
5. Reload `/dashboard`. Confirm it lazily flipped: `account_status = trial_expired`, `downgraded_at` set, access now **Limited**, 0 days remaining.
6. Confirm via RLS that the user cannot read another user's row (e.g. a direct query for another id returns nothing).
7. `.env.local` still not committed.

Commit message: `Day 3: trial state machine spine — profiles table, signup trigger, RLS, lazy expiry, dashboard status`.

---

## Working style
- Full, copy-paste-ready files and SQL. Never "edit line X".
- Stop and report after each task.
- If verification passes, STOP. Do not start the deposit/admin flow (Day 4).

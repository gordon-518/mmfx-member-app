# Signup country · Roadmap welcome page · Admin user management

**Date:** 2026-07-01
**Status:** Approved design — pending plan

Three related features.

## A1 — Country at signup

- Add `country text` (ISO-3166 alpha-2, e.g. `MY`) to `public.profiles`.
- **Email/password signup:** a required country `<select>` on `SignupForm`, its
  default pre-selected from `x-vercel-ip-country` (read server-side in
  `/signup/page.tsx`, passed as `defaultCountry`). Submitted via
  `signUp({ options: { data: { ..., country } } })`. `handle_new_user` trigger
  copies `country` from `raw_user_meta_data` into `profiles.country` (same pattern
  as `full_name`).
- **Google signup** (no form): capture `x-vercel-ip-country` server-side in
  `/auth/confirm` after `exchangeCodeForSession`, set-once (only when
  `profiles.country` is null), via a service-role update (mirrors
  `recordSignupIp`). → country coverage for 100% of new users.
- **Country list:** `src/lib/countries.ts` exports `COUNTRIES: {code,name}[]`
  (ISO list) — single source for the dropdown.

## A2 — Roadmap welcome page (`/welcome`)

A static "guide + promote" onboarding roadmap. Role: **first-run + permanent**.

- **Content:** the trader-development climb, built on the existing
  `STAGES`/`FOUNDATIONS` from `src/app/dashboard/rails.ts` (single source — import,
  don't duplicate):
  1. Read the market (Analysis) — Daily Analysis, Fundamental Desk
  2. Execute with confidence (Execution) — Signals, Indicators, Strategies
  3. Manage like a pro (Trade Management) — Live Classes, Know Your Style
  → summit "A profitable, independent trader"; Course + Library as foundation.
  Every feature card links to its page. Matches the approved mockup.
- **Rendering:** `src/app/welcome/page.tsx` renders inside `AppShell` (so the
  sidebar is present when revisited) + a `RoadmapJourney` component. An
  `EnterDeskButton` client component calls
  `supabase.auth.updateUser({ data: { roadmap_seen: true } })` then navigates to
  `/dashboard`.
- **First-run gate (in `src/proxy.ts`):** after the existing `getUser()`, redirect
  to `/welcome` when: `user` exists AND `user.created_at > ROADMAP_SINCE`
  (ship-date constant) AND `!user.user_metadata?.roadmap_seen` AND the path is not
  exempt. **Exempt:** `/welcome`, `/login`, `/signup`, `/forgot-password`,
  `/auth`, `/api`, `/privacy`, `/terms`, and non-page assets. Uses only the
  already-fetched `user` — no extra DB query. Existing users (created before
  `ROADMAP_SINCE`) are never redirected.
- **Permanent nav:** add a `{ label: "Start here", href: "/welcome", icon: … }`
  entry at the TOP of `NAV` in `AppShell` (a compass/map icon).

## B — Admin user management (Ban + Delete)

New "User management" `<section>` on `/admin`, `is_admin`-gated like the rest.

- **Lookup:** `fn_admin_find_user(p_email text)` — `SECURITY DEFINER`,
  search_path pinned, internally asserts `is_admin()`. Returns
  `{ id, email, account_status, banned }` for exact lowercased email matches
  (0..n rows). The server action requires **exactly one** row.
- **Ban / Unban (reversible):** server action → service-role GoTrue
  `admin.updateUserById(id, { ban_duration: "876000h" | "none" })`.
- **Delete (permanent):** server action → service-role `admin.deleteUser(id)`.
  Guards: resolve exactly one user; **refuse if `account_status = 'member_active'`**;
  require the admin to type the exact email (`confirmEmail` must equal the target).
- **UI:** `UserAdmin` client component — email input → "Look up" (calls a lookup
  server action) → shows the matched user (email, status, banned badge) → buttons
  **Ban/Unban** and **Delete** (Delete reveals a type-the-email confirm). All
  mutations are server actions in `src/app/admin/actions.ts` behind `requireAdmin`.
- Service-role admin client: a small server-only helper (mirrors the pattern in
  `src/lib/signupIp.ts`); never imported by client code.

## Data model summary

`alter table public.profiles add column country text;` (+ trigger update).
No column needed for roadmap (uses `user_metadata.roadmap_seen`) or ban (GoTrue
`banned_until`).

## Testing

- Unit (Vitest): `countries.ts` (list non-empty, codes unique); the admin
  delete/ban action guards — exactly-one-match enforcement, member_active refusal,
  email-confirm mismatch refusal (mock the service-role client + `requireAdmin`).
- Migration/functions applied + verified against DB.
- Preview: signup shows country dropdown (pre-selected from geo) → profile gets
  country; new user is redirected to `/welcome`, "Enter your desk" → dashboard and
  no longer redirected; "Start here" nav opens the roadmap; admin lookup →
  ban/unban/delete on a throwaway user (deleted afterward with the guarded tool).

## Out of scope (v1)

- Roadmap progress tracking.
- Phone / Telegram capture + SMS/WhatsApp automation (dropped — no contact data
  collected, so no opt-in needed).
- Backfilling country for existing users.

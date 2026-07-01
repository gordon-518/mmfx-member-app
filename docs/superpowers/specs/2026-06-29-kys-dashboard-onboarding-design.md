# KYS-first dashboard onboarding

**Date:** 2026-06-29
**Status:** Approved design — pending implementation plan

## Goal

Make **Know Your Style (KYS)** the first thing a trader does. Surface a prominent
onboarding hero at the top of the dashboard for anyone who hasn't completed KYS;
once they complete it, the hero disappears.

## Decisions (locked)

- **Forcefulness:** prominent hero pinned as the **first block** on the dashboard
  (above the market ticker). Not a forced redirect, not a subtle banner.
- **Completion signal:** captured when the user clicks **"Send me a copy"** in the
  KYS quiz — that already posts their `archetype` to `/api/kys/send-copy`. We
  record it on their profile there.
- **After completion:** the hero is simply **not rendered** (card gone). No badge,
  no archetype tailoring in v1.
- **Audience:** everyone who hasn't completed KYS **and has access to KYS**
  (Full tier = trial + members). Locked/expired users don't see it (they can't use
  KYS; they keep the upgrade nudge).

## Data model

Two nullable columns on `public.profiles`:
- `kys_completed_at timestamptz` — set on first completion (drives hide/show).
- `kys_archetype text` — the archetype string (already in the payload; stored for
  free, keeps a future "show your style" option open).

New function `fn_mark_kys_completed(p_archetype text)`:
- `SECURITY DEFINER`, `set search_path = ''`, fully-qualified — matches the repo's
  hardening for definer functions.
- `update public.profiles set kys_completed_at = coalesce(kys_completed_at, now()),
  kys_archetype = nullif(left(trim(p_archetype),120),'') where id = auth.uid();`
  — `coalesce` keeps the first-completion timestamp stable across re-takes.
- `grant execute` to `authenticated`; revoke from `public`/`anon`.

No change to `fn_resolve_trial_status` — it `returns public.profiles` and does
`select p.* into result`, so the new columns flow through to `getAccess`
automatically.

## Capture completion

In `src/app/api/kys/send-copy/route.ts`, after the email + SendPulse tag succeed,
call `supabase.rpc("fn_mark_kys_completed", { p_archetype: archetype })` using the
session server client. **Best-effort** — wrapped in try/catch, never blocks or
fails the response (mirrors the existing SendPulse tagging).

## Surface the flag

- Add `kys_completed_at: string | null` and `kys_archetype: string | null` to the
  `AccessProfile` interface in `src/lib/access/getAccess.ts`.
- `src/app/dashboard/page.tsx` computes `showKysOnboarding = !locked &&
  !access.profile.kys_completed_at` and passes it to `DashboardClient`.

## UI

New component `src/app/dashboard/KnowYourStyleOnboarding.tsx` (server component —
static content, no interactivity beyond a link):
- Warm-premium card: `START HERE` eyebrow (orange), heading "Know your trading
  style", body, primary CTA "Discover your style →" linking to
  `/bots/know-your-style`, and a "~2 min · 6 questions" hint. Compass icon motif.
- Matches the mockup approved 2026-06-29.

`DashboardClient` renders `<KnowYourStyleOnboarding />` as the **first block**
(above the market bar) only when `showKysOnboarding` is true.

## Edge cases

- Finished quiz but never sent a copy → hero persists (accepted).
- Re-take KYS → `coalesce` preserves original completion; hero stays hidden.
- Locked/expired users → never see the hero.
- Admin account → treated like any Full user (sees it until completed).

## Testing

- Extend `src/app/api/kys/send-copy/route.test.ts`: assert `fn_mark_kys_completed`
  RPC fires on a successful send, and that a failing RPC does NOT fail the response
  (best-effort).
- Migration + function applied and verified against the DB (column exists,
  function callable, definer + grants correct).
- Preview-verify: hero shows for a not-completed Full user; hidden once
  `kys_completed_at` is set.

## Out of scope (v1)

- Archetype-tailored dashboard content.
- Capturing completion when the user finishes the quiz but doesn't send a copy
  (would need a change in the separate KYS app).
- Any "show your style" badge after completion.

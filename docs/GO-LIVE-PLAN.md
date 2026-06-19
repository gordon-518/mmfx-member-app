# MMFX Member App — Go-Live Plan

*From "works on my laptop" to "soft-launched to Telegram, funnel proving."*
Three phases, in order. Don't soft-launch before Phase 2 passes.

---

## ⚠️ The one risk the build plan missed — read first

**Supabase's built-in auth email is rate-limited (a few dozen/hour) and meant for development.** Your whole login is magic-link, which means every signup sends an email. If you post to even a slice of your 116k Telegram audience, you will blow past that limit in minutes and **signups will silently fail** — people request a link, it never arrives, they bounce. You'd never know except the funnel just... doesn't fill.

**Fix before soft-launch:** wire a real email provider (Resend — which you already planned for nurture) as the **auth SMTP** in Supabase. This is separate from, and earlier than, the Week-3 nurture sequence. Auth email is a Phase-2 launch blocker, not a nice-to-have.

---

## Phase 1 — Production deploy (get it on a real URL)
The app is worth $0 until it's deployed. Owner mostly you + CC for any code.

1. **Vercel project** — connect the repo, deploy to production. Set env vars in Vercel (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Never** put the DB password or any service-role key in the app env.
2. **Custom domain** — point your app subdomain (e.g. `app.marketmakersfx.net`) DNS at Vercel.
3. **Supabase auth URLs** — Authentication → URL Configuration → set **Site URL** to the production domain and add it to **Redirect URLs**. (Right now it's `localhost:3000` — magic links will break in prod until you change this.)
4. **Gumlet** — domain-restrict playback to the production domain + confirm the email watermark is on.
5. **Storage** — confirm `eBooks` and `slides` buckets are still **Private** (the self-healing migration enforces it, but eyeball it).
6. **Smoke test on the live URL** — every page loads, nothing 500s.

## Phase 2 — Pre-launch verification (the deferred checklist — now)
Do NOT skip any of these. This is the last-10% that decides if launch works.

1. **Auth email via Resend SMTP** (the risk above) — configure custom SMTP in Supabase so magic links actually send at volume. Test that a link arrives in <1 min.
2. **THE signup-trigger test** — on the **production** URL, sign up with a fresh throwaway email. Confirm a `trial_active` profile row auto-appears and the dashboard loads. You have never tested this live; it's the single most important check. If it fails, every ad dollar is wasted.
3. **Broker link** — wire the real broker signup URL(s) into `/upgrade` (Octa for MY/ID, Dupoin for ROW; US/UK excluded). The "Fund your account" button is your only revenue action — it cannot point nowhere.
4. **Security rotations** (pending since Day 1) — rotate the Supabase DB password; revoke access token `sbp_5847…`. Update Vercel/.env.
5. **News provider paid plan** (~$20/mo) — upgrade off the trial so the news/calendar don't break post-launch.
6. **Meta Pixel + Conversions API (CAPI)** — launch-critical for a paid-ads business; without it the ad algorithm has no feedback loop and you overpay per signup. Required:
   - Fire **Signup** as the primary conversion event (server-side CAPI + browser pixel, deduped via `event_id`).
   - Also fire a deeper event on `member_active` (the deposit) — even though optimization starts on Signup, you need deposit events accumulating so you can switch Meta to value/deposit optimization later (~50+ conversions in). Track both from day one.
   - **Attribution chain / cross-domain wrinkle:** capture `fbclid` on ad landing (Astro marketing site), persist `fbp`/`fbc` on a **shared parent-domain cookie (`.marketmakersfx.net`)** so the click ID survives the marketing-site → app signup handoff and the Signup event is attributable to the ad. This is the piece that silently breaks attribution if not built deliberately.
7. **Full-funnel smoke test on prod:** fresh signup → trial → see gated content → admin-verify a (test) deposit → flips to `member_active`, access persists → separately, force a `trial_expired` and confirm Limited → `/upgrade` → broker link opens. Confirm the Signup + deposit events actually arrive in Meta Events Manager (use the Test Events tool).

## Phase 3 — Soft-launch (controlled, not the full blast)
1. **Small slice first.** Announce to a *subset* of the Telegram audience (or a "beta" cohort), not all 116k at once. Catch problems at low volume where they're cheap.
2. **Watch the funnel live** for the first cohort: are signups creating profiles? Are magic-link emails landing? Are people reaching the dashboard? Watch Supabase auth logs + the `profiles` table.
3. **Then scale** the announcement once the small cohort flows clean.

---

## What deliberately waits until AFTER first users
- **Email nurture sequence** (day 0/3/10/13) — needs the proactive expiry cron + Resend templates. Real, but it optimizes a funnel you must first prove exists.
- **Proactive trial-expiry cron** — lazy expiry already keeps access correct; the cron only matters once nurture needs a "trial expired" event to fire on.
- **Broker-deposit automation** — manual admin verification is fine at soft-launch volume.
- **TradingView auto-grant (Make)** — manual grant via admin is fine for now.
- **The 5 strategy scripts** — build when you build them; `/strategies` already has the slots.

---

## Recommended first move
Phase 1 deploy + Phase 2 step 1 (Resend auth SMTP) and step 2 (the signup test) are the unblockers. Everything else in Phase 2 can run in parallel. **Do not announce to Telegram until the production signup test passes and the broker link works.**

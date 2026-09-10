# Conversion Fix — Implementation Plan

**Source:** [MMFX Conversion Teardown](https://claude.ai/code/artifact/5a4a83c4-ff78-4262-8dc4-a581c5b065ff), the research behind every decision below.
**Written:** 10 Sept 2026 · **Open decisions resolved:** 10 Sept · **Scope:** member app only. Ad targeting is parked in [Later — Ads](#later--ads-parked).

---

## How to use this doc

This plan is meant to be carried out in a separate chat, one phase at a time.

- **Read first:** `AGENTS.md` (this is Next 16, so read `node_modules/next/dist/docs/` before writing code) and `docs/SCHEMA.md`.
- **One branch per phase, cut from `main`.** Split the big phases (3 and 5) into one PR per task.
- **Every schema change updates `docs/SCHEMA.md` in the same PR.** The `code-reviewer` agent checks work against SCHEMA.md, so a stale schema doc means a useless review.
- **Tests:** add `vitest` unit tests for every pure access or tier function (`npm test`). The existing `src/lib/trial/status.ts` + `audience.test.ts` pattern is the model to follow.
- **Tick the boxes** as tasks land. Each task lists **Where** (files) and **Done when** (acceptance criteria).

### Gotchas that will bite

- **RLS drops writes silently.** `profiles` has SELECT policies only (`profiles_select_own`, `profiles_select_admin`). A direct `.update()` from the user's session client matches zero rows and returns **no error**. All user-initiated profile writes must go through a `security definer` RPC, like `fn_set_tradingview_username`. This is exactly what broke attribution (task 1.1).
- **Function grants:** follow the existing pattern: `revoke execute … from public, anon;` then `grant execute … to authenticated;`. Revoking from `public` alone does not strip `anon`.
- **`src/proxy.ts` is the valid Next 16 name** (not `middleware.ts`). Reviewers false-positive it.
- **No point-in-time recovery or backups.** Deletes are permanent. Never run destructive SQL against prod. Backfills must be additive.
- **DB access** from scripts: use the IPv4 pooler (the direct host is IPv6-only). Migrations follow the `scripts/apply-*-migration.mjs` pattern.
- **`growth_daily` has NOT NULL columns.** Any new metric column must be added nullable, or old snapshots can't coexist with it.

---

## Baseline (measure every phase against this)

Pulled from prod, 7–10 Sept 2026.

| Metric | Value |
|---|---|
| Real post-launch signups → verified deposit | **36 / 3,763 = 0.96%** |
| `member_active` profiles | 148, of which **112 are grandfathered Softr members with no deposit record** |
| Deposits at exactly the $500 minimum | 30 of 37 (81%) |
| TradingView connected (activation proxy) | 8.1%, converting at 6.54% vs 0.46% without (14×) |
| Median signup → deposit | 11 days (p75: 33) |
| 14-day vs 7-day trial conversion (low-affordability geos excluded) | 4.17% vs 1.15% |
| Expired trials (`trial_expired` + `re_trial_expired`) | 3,667 |
| `last_activity_at` populated | 0 rows |
| `attr_cid` / `attr_geo` populated | 0 rows (92 signups since the 3 Sept deploy) |
| `member_active` with no `trading_account_number` | 49 (currently bounced to the `/dashboard` gate) |

---

## Decisions already made

These are settled. Don't reopen them in the fixing chat.

1. **Trial goes back to 14 days, for new signups only.** Median time-to-deposit is 11 days, and the 7-day cohort converted worse.
2. **Expired trials drop to a Free tier, not a locked door** (reverse trial).
3. **Daily Analysis is free**, video and PDF, for every signed-in user.
4. **Three paid tiers, gated on the member's cumulative verified deposits:**

   | Tier | Threshold | Pitch |
   |---|---|---|
   | Free | post-trial, $0 | Stay in the product; see what's locked |
   | **Foundation** | ≥ $50 | Learn the system, get the tools on your charts |
   | **Desk** | ≥ $200 | Take the calls |
   | **Team MM** | ≥ $500 | The full desk |

5. **Gate on cumulative verified deposits (a high-water mark), never on current balance.** Gating on balance would strip a member's access mid-drawdown.
6. **The 112 grandfathered Softr members get Team MM.** They must never be downgraded by the new tier logic.
7. **Trial access stays as it is today: equivalent to Desk.** Trials get everything except the AI Trading Assistant and Team MM, which are already member-only.

### Tier feature matrix

| Feature | Route(s) | Free | Foundation | Desk | Team MM |
|---|---|:-:|:-:|:-:|:-:|
| Economic Calendar | `/calendar` | ✓ | ✓ | ✓ | ✓ |
| News & sentiment | `/news` | ✓ | ✓ | ✓ | ✓ |
| Know Your Style | `/bots/know-your-style` | ✓ | ✓ | ✓ | ✓ |
| Daily Analysis (video + PDF) | `/daily-analysis` | ✓ | ✓ | ✓ | ✓ |
| Mentorship — Module 1 only | `/course`, `/api/slides/[slug]` | ✓ | — | — | — |
| Full Mentorship (19 lessons, 6 modules) | `/course`, `/api/slides/[slug]` | — | ✓ | ✓ | ✓ |
| MM Library (4 eBooks) | `/library`, `/api/ebooks/[slug]` | — | ✓ | ✓ | ✓ |
| 10 TradingView indicators | `/indicators` + TV grant automation | — | ✓ | ✓ | ✓ |
| Strategy scripts | `/strategies` | — | ✓ | ✓ | ✓ |
| Signals | `/signals` | — | — | ✓ | ✓ |
| Live Classes | `/live-classes` | — | — | ✓ | ✓ |
| Fundamental Desk | `/bots/fundamental` | — | — | ✓ | ✓ |
| AI Trading Assistant | `/journal`, `/journal/*`, `/api/reports/[id]` | — | — | — | ✓ |
| Team MM channel | `/team-mm` | — | — | — | ✓ |

### Decisions resolved 10 Sept

- [x] **Trial length:** 14 days applies to **new signups only**. Trials already running on a 7-day clock keep it, so there's no backfill. The copy changes on **both** the marketing site and the app (tasks 2.1a and 2.1b).
- [x] **Meta `Purchase` event:** fires on the **first deposit (FTD) only**. A top-up must never fire it (task 3.2).
- [x] **US/UK path:** **on hold.** Leave the current routing untouched (`regionFor()` → `contact`). Phase 6 is parked.

---

## Sequence

```
Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 5 ─► Phase 6
 scoreboard  instrument  free tier   tiers      in-app      US/UK (on hold)
                            │                    deposits
                            └──► Phase 4 (can run alongside Phase 3)
                                 onboarding
Phase 7 (measurement) runs continuously from Phase 1 onward.
```

Instrumentation comes first on purpose: every later phase is a change you'll want to measure, and today almost none of it is measurable.

---

## Phase 0 — Fix the scoreboard

*About half a day. Makes the numbers honest before anything changes.*

- [x] **0.1 Separate grandfathered members from real conversions in growth metrics.**
  `members_active` counts all 148 `member_active` rows, so the 112 legacy members inflate every conversion figure about 3×.
  **Where:** `src/lib/growth/metrics.ts`, `src/app/stats/page.tsx`, a new `growth_daily` column (nullable, e.g. `members_verified`).
  **Done when:** `/stats` shows verified members (those with `deposit_verified_at`) and legacy members separately, and the conversion rate uses verified deposits only.
  **Landed (10 Sep, branch `conversion-phase-0`):** nullable `growth_daily.members_verified` / `members_legacy` (migration `20260910000001`, applied to prod). `isLegacyMember()` + `computeConversion()` in `src/lib/growth/metrics.ts` (one place to swap in the `grandfathered` flag at task 3.1). `/stats` shows verified vs legacy, a "Signup → deposit" rate with legacy excluded from both sides, and a forward-only verified-members trend. The daily Telegram DM and the AI read now report verified members and are told legacy is not growth. Live on 10 Sep: **150 `member_active` = 38 verified + 112 legacy; signup → deposit = 38 / 3,801 = 1.00%.**

- [ ] **0.2 Look into the 49 `member_active` profiles with no `trading_account_number`.**
  `requireFull()` bounces these to the `/dashboard` gate on every member page. Check how many of them are grandfathered Softr members who were never asked for an account number.
  **Where:** a read-only query, then decide whether an email nudge is needed.
  **Done when:** there's a count split legacy vs verified, and a decision on whether to contact them.
  **Count (10 Sep):** 49 = **44 legacy** (no deposit record; profiles created 23 Jun – 1 Jul SGT during the Softr migration; 8 have a TradingView username) + **5 verified, paying members** (signed up 18 Jun – 8 Aug). `last_activity_at` has never been populated (task 1.2), so there is no signal on whether any of them still log in.
  **Decision: pending (Gordon).** Recommended: contact the **5 verified members** directly now; they paid and are gated out of what they paid for. Hold the **44 legacy** for a single email nudge after task 2.2 lands, when the gate offers them the Free tier instead of a wall.

---

## Phase 1 — Instrument the funnel

*1–2 weeks. A prerequisite for measuring everything after it.*

- [x] **1.1 Fix signup attribution. This is a bug, and the root cause is known.**
  `src/app/signup/actions.ts` writes `attr_cid/attr_geo/attr_feature` with a direct `.update()` from the session client. `profiles` has no UPDATE policy, so RLS matches zero rows and no error comes back. Result: 92 signups since the 3 Sept deploy, all with null attribution. Separately, the Google sign-in path (`src/app/auth/confirm/route.ts`) reads the `mmfx_attr` cookie but never persists it; it only forwards it to CAPI. The cookie itself is fine: it's set on `.marketmakersfx.net` and the app runs on `app.marketmakersfx.net`.
  **Fix:** a new `security definer` RPC `fn_set_signup_attribution(p_cid, p_geo, p_feature)` that acts on `auth.uid()`'s own row only, keeps first touch (update only where `attr_cid is null`), and uses the standard grant pattern. Call it from **both** paths.
  **Where:** new migration, `src/app/signup/actions.ts`, `src/app/auth/confirm/route.ts`.
  **Done when:** a test signup with an `mmfx_attr` cookie gets `attr_cid` set, through both the email-OTP and Google sign-in paths. (Organic `ORG-*` reporting via `organic_signups_by_cid` depends on this too, not only ads.)
  **Landed (10 Sept, `20260910000002_funnel_instrumentation.sql`, applied to prod):** RPC called from both paths. Beyond the spec: first touch applies to the whole `(cid, geo, feature)` tuple, only within 24h of `signup_at` (so a returning Google login with a new ad cookie can't re-attribute an old signup), and malformed cookie values are dropped instead of raising. Role-simulated smoke test passed; **the live end-to-end check (a real signup through each path) is still to do after deploy.** The 3–10 Sept signups stay unattributed, since the cookie is gone.

- [x] **1.2 Populate `last_activity_at`.**
  `getAccess()` already calls `fn_resolve_trial_status` on every gated page, so stamping activity there costs no extra round trip. Extend the function to set `last_activity_at = now()` **only when the existing value is null or older than 15 minutes**, to throttle writes.
  **Where:** new migration re-creating `fn_resolve_trial_status` (copy the live body verbatim and add the stamp).
  **Done when:** browsing as a test user sets `last_activity_at`, and repeat page loads within 15 minutes don't rewrite it.
  **Landed:** live body diffed against the migration; the only differences are the marked stamp. Smoke test confirmed the stamp. The only UPDATE trigger on `profiles` is the `updated_at` setter, and nothing reads `profiles.updated_at`.

- [x] **1.3 Add an event log.**
  A new `app_events` table (`id`, `user_id`, `event text`, `props jsonb`, `created_at`), RLS on, select for admins only, with inserts only through a `security definer` RPC `fn_log_event(p_event, p_props)` that takes the user from `auth.uid()` and rejects event names not on an allowlist. Add a server helper `logEvent()` in `src/lib/`, and a server action for client-side clicks.
  **Events to emit:**
  - `feature_view` with `{feature}`, on each gated route (hook it into the feature guard from task 2.2)
  - `tv_username_set`
  - `upgrade_viewed` with `{region}`
  - `upgrade_broker_link_clicked` with `{broker, flow}`
  - `upgrade_contact_clicked` with `{channel: whatsapp|telegram}`
  - `deposit_verified` with `{amount, tier}` (fired from the admin verify action)
  - Later phases add `deposit_submitted`, `tier_changed` and `onboarding_step_done`.
  **Where:** new migration, `src/lib/events.ts`, `src/app/upgrade/UpgradeFlow.tsx` (click handlers on the broker, WhatsApp and Telegram CTAs), `src/app/admin/actions.ts`.
  **Done when:** every event on the list shows up in `app_events` from a test user's session.
  **Landed:** there are two writers over one internal insert. `fn_log_event` (authenticated) accepts **only** the two click events, so a browser can't forge `deposit_verified`. `fn_log_event_as` (service_role) is for server renders via `after()`, where cookies are unavailable, and for admin actions on another user. `feature_view` is emitted via `requireFull({ feature })` on 13 gated pages and deduped per user and feature for 30 minutes; it moves into the 2.2 feature guard when that lands (the keys are in `src/lib/access/featureKeys.ts`). `tv_username_set` is logged inside the DB function. `deposit_verified` also carries `broker`. Props are capped at 1 KB. **To do after deploy: the live session check.**

- [x] **1.4 Timestamp activation.**
  Add `profiles.tv_connected_at timestamptz`, set inside `fn_set_tradingview_username` the first time a username is saved (never overwritten). Existing rows stay null; there's no reliable backfill.
  **Where:** new migration (re-create the function from its latest body in `20260806000001_tv_username_format.sql`), SCHEMA.md.
  **Done when:** saving a TV username sets `tv_connected_at` once.
  **Landed:** the function was re-created from the **live** body (identical to the file) using `coalesce`, so the stamp is never overwritten.

- [x] **1.5 Define activation and surface the funnel on `/stats`.**
  **Activation milestone:** TradingView connected **and** Daily Analysis viewed, both within 48 hours of signup.
  Add to `/stats`: activation rate, the upgrade funnel step counts (viewed → broker link clicked → contact clicked → verified), and conversion split by activated vs not.
  **Where:** `src/lib/growth/*`, `src/app/stats/page.tsx`.
  **Done when:** all three views render from real `app_events` data.
  **Landed:** `fn_admin_funnel_stats(p_days)` (admin-gated) aggregates in the database, avoiding the 1000-row cap; `src/lib/growth/funnel.ts` shapes the result. The activation cohort has to be at least 48h old and begin on or after 10 Sept (before that, neither signal existed), with legacy members excluded, so it **reads 0 until 12 Sept**.

---

## Phase 2 — Trial shape and the Free tier

*1–2 weeks. Ships the reverse trial.*

- [x] **2.1a Trial back to 14 days: database and app.** *New signups only (decided 10 Sept). Trials already running keep their 7-day clocks, so no backfill.*
  Write one new migration re-creating the three clock-minting functions, changing **only** `interval '7 days'` → `interval '14 days'` and the "7-day clock" comment text. **Copy each body from its latest definition, not from the 7-day migration:**

  | Function | Latest body |
  |---|---|
  | `handle_new_user` | `20260824000001_restore_signup_fingerprint.sql` ⚠ |
  | `fn_grant_retrial` | `20260715_seven_day_trial.sql` |
  | `fn_admin_update_member` | `20260715_seven_day_trial.sql` |

  ⚠ `handle_new_user` was re-created on 24 Aug to capture `signup_fingerprint`. Copying it from `20260715_seven_day_trial.sql` would silently remove the signup-abuse fingerprinting. Before writing the migration, confirm each live body with `select pg_get_functiondef('public.handle_new_user'::regproc);` (and the same for the other two), then diff it against the file.

  **App copy to change (7 → 14):**
  - `src/components/auth/SignupForm.tsx`: "7-day free trial", "free for 7 days"
  - `src/components/auth/AuthShell.tsx`: "7 days of full access, free"
  - `src/app/signup/page.tsx`: the meta description
  - `src/app/upgrade/page.tsx`: "Your 7 days are up." (task 2.5 rewrites this screen for the Free tier anyway; change the number now so it's never wrong in between)
  - `src/lib/channel/draft.ts`: the Telegram channel drafting prompt tells the model that CTA posts may invite "a free 7-day trial". This one isn't in commit `973c75b`, so it's easy to miss.
  - Comments only, no user impact (update for accuracy): `src/lib/meta-capi.ts`, `src/app/admin/abuse/page.tsx`
  - **Leave alone:** `src/lib/forexNews.ts` and `src/lib/growth/narrative.ts` say "7 days" about the calendar window and week-over-week stats, not the trial.

  **Outside the repo:** check the SendPulse trial automations and email templates for "7 days" / "7-day" and update them in the SendPulse dashboard.
  **Done when:** a new test signup gets `trial_ends_at = signup_at + 14 days`; an existing 7-day trial's `trial_ends_at` is unchanged; `signup_fingerprint` is still captured on the test signup; and no user-facing app copy or email says 7 days.
  **Landed (10 Sept, `20260910000003_trial_14_days.sql`, applied to prod):** generated from the three live bodies, with only the interval changed; the live body now equals the committed file. A test signup inside a rolled-back transaction got exactly 14 days and kept its fingerprint, and the 98 running trials were unchanged. App copy changed in 7 files; only the calendar-window and week-over-week mentions still say 7 days. **Still open, outside the repo: SendPulse trial automations and templates (Gordon, in the SendPulse dashboard).**

- [x] **2.1b Trial back to 14 days: marketing site.** *Separate repo at `~/Documents/Claude/mmfx-marketing-site`. It has no GitHub remote: deploy with `npx vercel --prod --yes` from that folder after every change.*
  72 trial-length mentions across 21 files:

  | File | Mentions |
  |---|---|
  | `src/content/features.ts` | 10 (feature CTAs) |
  | `src/content/home.ts` | 5 |
  | `src/content/faq.ts` | 4 (two FAQ answers, each duplicated) |
  | `src/content/howItWorks.ts` | 3 |
  | `src/content/legal.ts` | 2, **the Terms' trial clause** (bump the Terms' "last updated" date if it shows one) |
  | `src/content/lp.ts` | 1 (the default landing-page CTA) |
  | `src/app/layout.tsx` | 1, **the site meta description** (what Google shows) |
  | `src/app/faq/page.tsx` | 2 |
  | `src/app/features/page.tsx` | 1 |
  | `src/components/HowItWorksContent.tsx` | 1 (the "7 days free" badge) |
  | `src/components/lp/LandingPage.tsx` | 4 |
  | `src/components/features/*Feature.tsx`: AiTradingAssistant (3), KnowYourStyle (3), and DailyAnalysis, EbookLibrary, FundamentalDesk, Indicators, LiveClasses, MmSystem, Signals, Strategies (4 each) | 38 |

  **Do NOT change `src/lib/tracking.ts:103`.** The `// 7 days` there is the lifetime of the `mmfx_attr` attribution cookie, not the trial. Changing it alters how long an ad or post click stays attributed.
  **Ship order:** deploy the app migration (2.1a) first, then the marketing site **the same day**. The site must never promise 14 days while the app still grants 7.
  **Done when:** `grep -rniE "7[- ]day|7 days|seven[- ]day" src` in the marketing site returns only `src/lib/tracking.ts`; the production pages (home, FAQ, how it works, every feature page, landing pages, Terms) say 14 days; and the deploy is live.
  **Landed (10 Sept, same day as 2.1a):** 73 mentions changed across 21 files, and the Terms' "last updated" is now September 2026. The grep returns only `tracking.ts:103`. Deployed, and the live check shows `marketmakersfx.net` and `www` with 16 "14-day" mentions and no "7-day". The app's `/signup` also shows 14.

- [x] **2.2 Replace blanket `requireFull()` with a feature-level access map.**
  Today 18 routes call `requireFull()`, which bounces every expired user to `/upgrade`. Add one source of truth, `src/lib/access/features.ts`, mapping each feature key to the minimum access it needs, plus a guard `requireFeature(key)` that returns the profile or renders or redirects to a locked preview.
  In this phase the map has two levels: **free** (Limited) and **full** (trial or member). Phase 3 expands it to the tier ladder without touching every page again.
  Keep the existing rule that sends a `member_active` user with no `trading_account_number` to `/dashboard`.
  **Routes currently on `requireFull`:** `api/ebooks/[slug]`, `api/reports/[id]`, `api/slides/[slug]`, `bots/BotPage.tsx`, `bots/fundamental`, `bots/know-your-style`, `calendar`, `course`, `daily-analysis`, `indicators`, `journal/connect`, `journal/ib`, `journal`, `library`, `live-classes`, `news`, `signals`, `strategies`.
  **Done when:** every route above goes through `requireFeature`, and the map has unit tests.
  **Landed:** `src/lib/access/features.ts` is pure and client-safe; the nav reads it too. It has three levels: free, full, and member (the journal pages' existing member-or-admin rule). `requireFeature(key)` returns `{ profile, tier, viewer, locked }`. Download routes use `onLocked: "redirect"` and `log: false`. `requireFull.ts` is deleted. **Correction to the matrix above:** `/api/reports/[id]` serves the **Daily Analysis PDF**, not the AI Trading Assistant, so it's mapped to `daily-analysis` (free). The journal's JSON API keeps its own guard (`src/lib/journal/api.ts`).

- [x] **2.3 Open the Free surfaces.**
  Free (Limited) users can reach `/calendar`, `/news`, `/bots/know-your-style`, `/daily-analysis` (including the PDF download) and **Module 1 of the course**. Module 1 needs per-lesson gating: `src/app/course/page.tsx` builds from `LESSONS`/`MODULES`, and `/api/slides/[slug]` must allow Module 1 slugs only for Free users.
  **Done when:** an expired test user can use all five surfaces, and gets refused on lessons outside Module 1 and on their slides, both in the page and through the API.
  **Landed:** these were also blocked in the database, because storage and table RLS were a second Full-only gate. `20260910000004_free_tier_access.sql` (applied to prod) adds signed-in reads of published analyses, published report PDFs, and Module 1's three decks. Verified as the real `authenticated` role in a rolled-back transaction, and in the browser as an expired test user: the Module 1 deck gives 200, the Module 2 deck redirects to `/upgrade`, locked lessons ship no video id, and the eBook download redirects. A vitest keeps the policy's deck list in sync with `courseData.ts`.

- [x] **2.4 Show locked features instead of redirecting.**
  Free users see every nav item. A locked route renders a preview of the page under `LockedOverlay` (`src/lib/access/LockedOverlay.tsx`) with a tier-specific CTA, rather than a redirect to `/upgrade`. The dashboard already computes `locked`; reuse that.
  **Where:** `src/components/AppShell.tsx` (nav), the `requireFeature` locked branch.
  **Done when:** every locked route shows a preview and a CTA, with no redirect loops. Test a member with no trading account number too.
  **Landed:** `src/components/LockedFeature.tsx` renders static art and copy under `LockedOverlay`, plus the list of what's open on Free. Nothing gated is fetched to render it. The nav shows every feature, with a lock on the ones outside the viewer's plan. No-profile and no-trading-account-number cases both go to `/dashboard`, which renders them without redirecting, so there's no loop.

- [x] **2.5 Update labels and lifecycle messaging.**
  AppShell's `"Limited access"` label becomes **"Free"**. Rewrite the trial-expiry copy from "your access ended" to "you're on Free; here's what's locked". Update the SendPulse `audience` semantics (`src/lib/audience.ts`, `src/lib/sendpulseSync.ts`) so `expired` is understood as a Free-tier user.
  **Done when:** no user-facing copy calls a Free user "expired" or "locked out".
  **Landed:** the nav label reads "Free". The dashboard hero changes from "Your trial's ended / tools are locked" to "You're on Free". `/upgrade` has Free and trial versions of its copy and no longer claims KYS is locked. The dashboard slide says "Free plan". `audience.ts` documents that `expired` means Free; the value is unchanged so SendPulse segments keep working. **Still open, outside the repo:** reword the SendPulse emails for the `expired` audience in the dashboard (Gordon).

---

## Phase 3 — The three paid tiers

*2–3 weeks. Split into PRs by task.*

- [x] **3.1 Keep a deposit ledger and a cumulative total.**
  New table `deposit_events` (`id`, `user_id`, `amount`, `broker`, `ib_confirmed`, `verified_by`, `verified_at`, `note`), select for admins only. `profiles.deposit_amount` becomes **the cumulative sum of verified deposits**, maintained by the RPC, never computed on the fly. Backfill one `deposit_events` row per existing verified member from their current `deposit_amount` and `deposit_verified_at`.
  Add `profiles.grandfathered boolean default false` and set it `true` for the 112 `member_active` rows with `deposit_verified_at is null`. That makes the legacy rule explicit instead of relying on null semantics.
  **Done when:** the backfill row count equals the verified member count, `grandfathered` count = 112, and SCHEMA.md is updated.
  **Landed (10 Sept, `20260910000005_deposit_ledger.sql`, applied to prod):** 38 ledger rows for 38 verified members, with `sum(amount) = deposit_amount` for each, and 112 grandfathered, none of them verified. Applied twice to prove it's idempotent. Non-admins can't read or write the ledger. `verified_by` is an admin uuid and is null on backfilled rows. Growth metrics still define "legacy" as no deposit record, which is the same set today. Tier logic (3.3) keys off `grandfathered`, so a grandfathered member who later deposits stays Team MM.

- [x] **3.2 Let `fn_verify_deposit` handle tiers and top-ups.**
  Today it rejects `p_amount < 500`, **rejects anyone already `member_active`** (so a top-up can't be recorded at all), and **overwrites** `deposit_amount`. Change it to:
  - minimum **$50** per verified deposit
  - allow already-member users; the verification becomes a top-up
  - insert into `deposit_events` and add the amount to `deposit_amount`
  - keep the partnered-broker and IB-confirmed checks
  - the first deposit flips `trial_*` → `member_active` exactly as today
  Update the admin action (`src/app/admin/actions.ts` → `verifyDeposit`) and emit `deposit_verified` / `tier_changed` events. The CAPI `Purchase` event fires on the **first deposit only** (decided 10 Sept). **Guard this explicitly:** today `verifyDeposit` fires `Purchase` on every call, which was only safe because `fn_verify_deposit` rejected anyone already a member. Once top-ups are allowed, every top-up would fire a second `Purchase`. Send it only when the verification flips the user to `member_active`.
  **Done when:** a $50 deposit creates a Foundation member, a later $150 top-up takes them to Desk, both show in the ledger, and the top-up sends no CAPI `Purchase`.
  **Landed (10 Sept, `20260910000006_verify_deposit_tiers.sql`, applied to prod), shipped after 3.3 so a $50 member is Foundation, not full access:**
  - Proved against prod as a real admin in a rolled-back scenario: $49.99 is refused; $50 makes a member at $50 cumulative; a $150 top-up is accepted and reaches $200 (Desk); the ledger has 2 rows credited to the admin; `deposit_verified_at` doesn't move on the top-up.
  - `verifyDeposit` reads the member's state before calling the RPC. The CAPI `Purchase` fires only on a true first deposit: no earlier verification, and not already a member. So a top-up, a re-verified removed member, or a grandfathered member's first recorded deposit sends nothing.
  - `deposit_verified` carries `{amount, broker, cumulative, tier, first}`, where `tier` is the new cumulative tier (Phase 1 review follow-up). `tier_changed {from, to}` fires when the tier moves and is on the DB allowlist.
  - The admin form accepts $50 and up and shows "Top up" for members.
  **Carried over from the Phase 1 review:**
  - `verifyDeposit` tags `deposit_verified` with `tier: paidTierFor(amount)`, the tier for **that one deposit**. That's correct today only because every verification is a first deposit of at least $500. When top-ups land, switch it to the tier for the **new cumulative total** (`deposit_amount` after the insert), or every top-up will misreport its tier.
  - `fn_set_signup_attribution` treats first touch as all-or-nothing on `(cid, geo, feature)`. That's fine while both callers pass the whole cookie. If a caller ever passes a partial tuple, switch to per-field `coalesce`.

- [x] **3.3 Build the tier model.**
  Replace `AccessTier = "Full" | "Limited"` (`src/lib/trial/status.ts`) with a tier derived by a pure function, `tierFor(profile, now)`:
  - `grandfathered` → **team**
  - `member_active` with cumulative ≥ 500 → **team**, ≥ 200 → **desk**, ≥ 50 → **foundation**
  - active trial within its clock → **trial** (grants Desk-equivalent access)
  - everything else → **free**
  Then update `getAccess()`, the feature map from task 2.2 (use the tier feature matrix above), and every `isMemberActive()` check. `/team-mm` and `/journal` become `tier === "team"`, and the journal API guard in `src/lib/journal/api.ts` must change to match.
  **Done when:** unit tests cover every threshold edge (49.99 / 50 / 199.99 / 200 / 499.99 / 500), grandfathered, trial in and out of its clock, and expired. Every route enforces the matrix.
  **Landed (built before 3.2 on purpose):** 3.2's $50 minimum would otherwise have turned a $50 depositor into a full member with Team MM under the old binary model.
  - `tierFor()` lives in `src/lib/tiers.ts` and is pure. Team MM applies to grandfathered members only while they are `member_active`. A member set by hand with no qualifying deposit gets Foundation instead of being locked out. A trial is Desk-equivalent.
  - `getAccess()` adds `memberTier`. `features.ts` now holds the matrix as minimum tiers.
  - These all use one map: requireFeature, the nav, the locked-preview CTAs ("Unlocks at Desk · $200"), `/team-mm` (was `isMemberActive`, which is now removed), the journal API (`requireMemberApi` → Team MM), and both "send me a copy" routes. The KYS send-copy route still required Full access after Phase 2, which was a bug.
  - The coarse `tier` (Full/Limited) stays as a derived view for the dashboard and `/upgrade`.
  - Prod distribution today: 150 members are all Team MM (38 verified at $500 or more, plus 112 grandfathered), 91 trials, 3,673 Free. No one's access changes on deploy.

- [ ] **3.4 Check the TradingView grant automation against the new tiers.**
  Indicators and strategies now start at Foundation, and Free users must lose access. Check which rule `src/lib/tv/*` and `syncTV()` (called from `verifyDeposit`) use to grant and revoke today, and re-point it to `tierFor`: grant for trial and Foundation+, revoke for free.
  **Done when:** grant and revoke follow the tier on verify, on top-up and on trial expiry.

- [ ] **3.5 Gate signal delivery to Desk and above.**
  Check how `/signals` hands out the Telegram signals channel, and how `/team-mm` hands out the VIP channel. Only render invite links for the correct tier. **Known limitation:** a Telegram invite link, once shared, can't be revoked per user. If per-user control matters, that needs a bot-issued single-use link, which is a separate task.
  **Done when:** Free and Foundation users can't see the signals invite link, and non-Team users can't see the Team MM link.

- [ ] **3.6 Redesign the upgrade page as three tiers.**
  Keep the geo routing as it is (`regionFor()` and `DUPOIN_COUNTRIES` in `src/app/upgrade/page.tsx`; US/UK keeps its current contact path, since Phase 6 is on hold). Show three tier cards with their thresholds and contents. For an existing paid member, show the current cumulative deposit and **"top up $X to unlock <next tier>"**. Add this copy line near Signals: *"We don't send calls to an account that can't survive them."*
  **Done when:** it renders correctly for a free user, each paid tier, and an admin `?geo=` preview.

- [ ] **3.7 Update admin, nav and email sync.**
  - **Admin:** show the tier, the cumulative deposit and the ledger per user; add a "record top-up" form.
  - **AppShell:** show the tier name; locked items say which tier unlocks them.
  - **SendPulse sync:** add a `tier` variable.
  **Done when:** all three show the correct tier for a test member at each level.

---

## Phase 4 — Guided onboarding

*1–2 weeks. Can run alongside Phase 3; depends on Phases 1 and 2.*

- [ ] **4.1 Replace the `/welcome` roadmap with an onboarding checklist.**
  Five steps, one a day, with a progress bar:
  1. Connect TradingView and get the indicators on your chart
  2. Watch today's Daily Analysis
  3. Take Know Your Style
  4. Finish Module 1, lesson 1
  5. See what Desk adds (the tier prompt, tailored to the KYS archetype)
  Store progress as `onboarding_step_done` events (task 1.3). Keep the existing `roadmap_seen` first-run gate in `src/proxy.ts`, pointed at the new page.
  **Where:** `src/app/welcome/*` (`RoadmapJourney.tsx` already groups content into stages: Read the market / Execute with confidence / Manage like a pro. Reuse those stages).
  **Done when:** a new test user sees the checklist first, and progress persists across sessions.

- [ ] **4.2 Add a dashboard checklist card** that shows until all five steps are done.

- [ ] **4.3 Mirror the steps in email.** This is content work. Set up SendPulse triggers for "step N not done by day N". Document the trigger list in this doc when it's built.

- [ ] **4.4 Group the nav by trader stage.** Use the same three stages as the roadmap, so a new user isn't faced with every feature at once.

**Target:** TradingView connection from 8% to 25%, and the activation rate from task 1.5 moving with it.

---

## Phase 5 — In-app deposit submission

*About 2 weeks. Depends on Phase 3.*

- [ ] **5.1 Build a deposit submission form on `/upgrade`.**
  Fields: broker, trading account number, deposit amount, TradingView username, screenshot upload. Uploads go to a new **private** storage bucket `deposit-proofs`: users can write only their own folder; only admins can read. Follow the existing gated-bucket migrations. Each submission creates a `deposit_submissions` row (`status: pending | verified | rejected`, `reject_reason`). The form becomes the **primary** CTA; WhatsApp and Telegram stay as "need help?".
  **Done when:** a test user can submit, and sees the pending status on `/upgrade`.

- [ ] **5.2 Build an admin review queue.** Pending submissions with the proof image. **Verify** calls the Phase 3 RPC; **Reject** takes a reason that's shown to the user.

- [ ] **5.3 Add notifications.** A Telegram DM to the admin on each new submission (reuse `src/lib/telegram.ts` / `notify.ts`), and an email to the user on verify or reject.

- [ ] **5.4 Top-ups use the same form.** A paid member submitting a top-up moves up the ladder through the same queue.

- [ ] **5.5 Add a hot-leads list to admin.** Users who hit the activation milestone, have had 3+ sessions, and viewed `/upgrade` without submitting. It's a working list for manual WhatsApp follow-up.

**Done when (phase):** the upgrade funnel on `/stats` shows `deposit_submitted` between "contact clicked" and "verified", so drop-off is visible step by step.

---

## Phase 6 — US/UK path (on hold)

*On hold (decided 10 Sept).* Leave the current routing untouched: `regionFor()` sends US and GB to `contact`, and the lifetime fee is arranged over Telegram. Don't change the `contact` branch of `/upgrade` during task 3.6.

When this is picked back up, here's the case for it: the UK has the highest TradingView connection rate of any market (21.7%) and zero conversions. The options were (a) a real checkout, or (b) a clear in-app offer card with one-click contact, plus whether to show the price in-app.

---

## Phase 7 — Measurement (ongoing from Phase 1)

- [ ] **Tier cohort report:** 90-day cumulative deposits per acquired member, by entry tier. This is the metric that decides whether the ladder is working, not conversion rate.
- [ ] **Daily Analysis viewers vs non-viewers**, conversion from Free to paid. If viewers convert *worse*, the free read is satisfying demand rather than creating it; hold back the PDF levels rather than pulling the read.
- [ ] **14-day trial cohort** vs the 7-day baseline (4.17% vs 1.15%).
- [ ] **Activation rate and TradingView connection rate**, week over week, against the Phase 4 target.

---

## Later — Ads (parked)

Do these when the ad work starts. Several depend on Phase 1 being done.

- **Exclude India** from paid targeting: 899 signups → 2 deposits, plus a legal barrier to funding offshore FX accounts. **Cap or exclude Indonesia** (649 → 1).
- **Shift spend to Malaysia, Singapore and the Gulf**, which convert at 2.9–3.5% on about 7% of spend.
- **Move the Meta optimisation event off `CompleteRegistration`** to a mid-funnel event there's enough volume of, such as TradingView connected or broker link clicked, fired via CAPI. Needs the Phase 1 events.
- **`Purchase` fires on FTD only** (decided 10 Sept). If value-based optimisation is wanted later, send top-ups as a separate custom event rather than a second `Purchase`.
- **Update the trial claim in ad-facing docs before any new creative.** The agency packs (`05-COMPLIANCE.md` and `03-LANDING-PAGES-AND-TRACKING.md`, in all four `agency-pack*` copies) and `MMFX_LAUNCH_FEATURES.md` still say 7-day. Check the ad creative skills' briefs for the same claim.
- **Add a qualifying question at signup** ("Funded trading account today? None / under $500 / $500+"). It's an app change, but it trades signup volume for lead quality, so ship it with the ads work.
- **Campaign-level reporting from `attr_cid`.** Needs task 1.1.
- **Nigeria** (1.02% conversion, 17.3% TradingView connection) as a Foundation-tier audience rather than an exclusion.
- **Explore a low-capital offer** (subscription or prop-firm partnership) for the geos that won't fund a broker account.

---

## Appendix — key files

| Area | Files |
|---|---|
| Access resolution | `src/lib/access/getAccess.ts`, `requireFull.ts`, `LockedOverlay.tsx`, `index.ts` |
| Trial state and tier | `src/lib/trial/status.ts` (`AccessTier`, `accessTier()`) |
| Request gate / first-run | `src/proxy.ts` |
| Deposit verification | `src/app/admin/actions.ts` (`verifyDeposit`), `fn_verify_deposit` in `supabase/migrations/20260610142014_null_trial_clock_for_members.sql` |
| Trial clock functions | `supabase/migrations/20260715_seven_day_trial.sql` |
| Upgrade funnel | `src/app/upgrade/page.tsx` (`regionFor`), `UpgradeFlow.tsx` |
| Signup and attribution | `src/app/signup/actions.ts`, `src/app/auth/confirm/route.ts`, `20260903000001_profile_attribution.sql` |
| Journal / AI Trading Assistant gate | `src/app/journal/page.tsx`, `src/lib/journal/api.ts` |
| Growth metrics | `src/lib/growth/metrics.ts`, `src/app/stats/page.tsx`, `src/app/api/cron/daily-stats/route.ts` |
| Email sync | `src/lib/audience.ts`, `src/lib/sendpulseSync.ts` |
| Onboarding | `src/app/welcome/*` |
| Schema reference | `docs/SCHEMA.md` |

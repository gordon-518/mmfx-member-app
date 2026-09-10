# MMFX Member App — Database Schema

**Status:** Draft, awaiting approval before any SQL or migrations are written.

---

## Overview

`profiles` extends Supabase `auth.users` and holds every field needed for the trial/membership state machine, deposit verification, and content gating. Verified deposits are also recorded one row each in `deposit_events` (conversion-fix 3.1): a member can top up, and tiers gate on the cumulative total kept in `profiles.deposit_amount`.

---

## Table: `profiles`

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | — | no | PK. References `auth.users(id)` on delete cascade. |
| `email` | `text` | — | no | Denormalized from `auth.users` for query convenience. |
| `full_name` | `text` | — | yes | Display name. |
| `signup_at` | `timestamptz` | `now()` | no | When the user first signed up. |
| `trial_ends_at` | `timestamptz` | — | yes | Set at signup to `signup_at + 14 days` (signups from 15 Jul to 10 Sep 2026 got 7 days; restored to 14 in `20260910000003_trial_14_days.sql`, with no backfill). Stored, never computed on the fly. **Null for members** — cleared on the flip to `member_active` (2026-06-10). A CHECK guarantees `trial_active`/`re_trial_active` always have a clock. |
| `trial_count` | `integer` | `1` | no | Lifetime trial count. Initial signup = 1, re-trial bumps to 2. Hard cap of 2. |
| `account_status` | `text` | `'trial_active'` | no | One of: `trial_active`, `trial_expired`, `member_active`, `re_trial_active`, `re_trial_expired`. See state machine below. |
| `member_status` | `text` | `'inactive'` | no | `active` or `inactive`. Set to `active` on qualifying deposit. Exists for future activity-gating — not enforced at launch. |
| `last_known_trading_activity` | `timestamptz` | — | yes | Last known trade date from broker data. For future activity-gating. Null until first data received. |
| `broker` | `text` | — | yes | `octa`, `dupoin` or `elev8`. Null until deposit is submitted. |
| `deposit_amount` | `numeric` | — | yes | **Cumulative** verified deposits: always `sum(deposit_events.amount)` for the user, maintained by `fn_verify_deposit` and never computed on the fly (conversion-fix 3.1). Tiers gate on this high-water mark, never on balance: Foundation ≥ $50, Desk ≥ $200, Team MM ≥ $500. Null = no verified deposit. |
| `deposit_verified_at` | `timestamptz` | — | yes | When the **first** deposit was verified (the conversion timestamp the growth metrics count). Top-ups don't move it (conversion-fix 3.2). Null = no verified deposit. |
| `deposit_verified_by` | `text` | — | yes | `manual`, `broker_postback`, or `webhook`. Launch uses `manual`. |
| `ib_link_confirmed` | `boolean` | `false` | no | Whether the deposit is attributed to our IB link. Separate from deposit amount — a deposit without IB attribution does NOT qualify, whatever its size. |
| `grandfathered` | `boolean` | `false` | no | Softr-era member migrated without a deposit record. **Always Team MM, never downgraded** by tier logic (conversion-fix decision 6). Set once for the 112 `member_active` rows with no `deposit_verified_at` by `20260910000005_deposit_ledger.sql`. Explicit, so the rule no longer rests on null semantics. |
| `last_activity_at` | `timestamptz` | — | yes | Last app activity. Stamped by `fn_resolve_trial_status` (every gated page, via `getAccess()`), throttled to one write per 15 min (conversion-fix 1.2). Empty before 10 Sep 2026. |
| `downgraded_at` | `timestamptz` | — | yes | When the user was downgraded. Used in re-trial eligibility computation. Null if never downgraded. Cleared on member upgrade and re-trial grant. |
| `is_admin` | `boolean` | `false` | no | Admin flag (Day 4). Set manually in SQL only, never from the app. Gates the admin SELECT policy and the admin-only functions via `is_admin()`. |
| `tradingview_username` | `text` | — | yes | TradingView handle the user submits to request indicator access (Day 6). Set only by `fn_set_tradingview_username` on the user's own row; indicator granting is manual. |
| `tv_connected_at` | `timestamptz` | — | yes | When the user **first** saved a TradingView username: the activation timestamp. Set once inside `fn_set_tradingview_username`, never overwritten. Null for users who connected before 10 Sep 2026 (no reliable backfill). |
| `attr_cid` / `attr_geo` / `attr_feature` | `text` | — | yes | Signup attribution from the marketing site's `mmfx_attr` cookie: cid (`CRT-…` paid, `ORG-…` organic), 2-letter geo, feature slug. Written only by `fn_set_signup_attribution`: own row, first touch on the whole tuple, within 24h of signup, malformed values dropped. Null for direct signups, and for every signup 3–10 Sep 2026 (the RLS bug fixed in conversion-fix 1.1). |
| `created_at` | `timestamptz` | `now()` | no | Row creation time. |
| `updated_at` | `timestamptz` | `now()` | no | Updated via trigger on every row change. |

### Constraints

- `account_status` checked against allowed values: `trial_active`, `trial_expired`, `member_active`, `re_trial_active`, `re_trial_expired`.
- `member_status` checked against: `active`, `inactive`.
- `broker` checked against: `octa`, `dupoin`, `elev8`.
- `deposit_verified_by` checked against: `manual`, `broker_postback`, `webhook`.
- `trial_count` checked: `>= 1 AND <= 2`.

All enums use `text` + check constraints rather than Postgres enum types — easier to extend without migrations.

---

## Table: `deposit_events`

The verified-deposit ledger (conversion-fix 3.1): one row per verified deposit, first deposits and top-ups alike. `profiles.deposit_amount` is the per-user sum. RLS is on, admins may `SELECT`, and nobody writes directly: rows come only from `fn_verify_deposit` (task 3.2). Defined in `20260910000005_deposit_ledger.sql`.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `bigint` identity | no | PK. |
| `user_id` | `uuid` | no | FK `profiles(id)`, on delete cascade. |
| `amount` | `numeric(12,2)` | no | `> 0`. |
| `broker` | `text` | no | `octa`, `dupoin` or `elev8`. |
| `ib_confirmed` | `boolean` | no | IB attribution confirmed at verification. |
| `verified_by` | `uuid` | yes | The admin who verified it; FK `profiles(id)`, on delete set null. **Null for backfilled rows**, because the old flow only recorded `'manual'`. |
| `verified_at` | `timestamptz` | no | Default `now()`. |
| `note` | `text` | yes | Free text. Backfilled rows say so. |
| `created_at` | `timestamptz` | no | Default `now()`. |

**Writer — `fn_verify_deposit(target_user_id, p_broker, p_amount, p_ib_confirmed)`** (admin-only, `20260910000006`): refuses anything under $50, a non-partner broker, or an unconfirmed IB link. It inserts the ledger row (`verified_by = auth.uid()`), adds the amount to `deposit_amount`, flips the account to `member_active` and clears the trial clock. `deposit_verified_at` stays at the first verification. An existing member may be verified again: that's a top-up.

**Backfill (10 Sep 2026):** one row per verified member (38) from their existing `deposit_amount` and `deposit_verified_at`, so `sum(amount) = deposit_amount` holds from day one. Verified after applying, and the migration was re-run to confirm it's idempotent.

---

## Free-tier read access (conversion-fix 2.3)

A Free user is a signed-in user without Full access (an expired trial; the reverse trial). `src/lib/access/features.ts` is the app-side map. These policies, from `20260910000004_free_tier_access.sql`, are the matching database side. They are additive: every `*_full` policy is unchanged, and policies OR together.

| Policy | On | Grants signed-in users |
|---|---|---|
| `daily_analysis_select_signed_in` | `public.daily_analysis` | `SELECT` on **published** rows. Drafts remain Full-only through `daily_analysis_select_full`. |
| `analysis_reports_signed_in_read` | `storage.objects`, bucket `analysis-reports` | `SELECT` on objects that are the `report_path` of a **published** entry, so a draft's PDF can't be fetched by guessing its path. |
| `slides_module1_signed_in_read` | `storage.objects`, bucket `slides` | `SELECT` on Module 1's three decks, listed by file name. `src/lib/access/course.test.ts` fails if the list drifts from `courseData.ts`. |

Still Full-only: `live_classes`, the `eBooks` bucket, and `slides` outside Module 1.

---

## Table: `app_events`

Funnel event log (conversion-fix 1.3). RLS on; admins may SELECT; nobody writes directly. Defined in `20260910000002_funnel_instrumentation.sql`.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `bigint` identity | no | PK. |
| `user_id` | `uuid` | no | FK `profiles(id)`, on delete cascade. |
| `event` | `text` | no | One of the allowlist below. |
| `props` | `jsonb` | no | A JSON object of at most 1 KB. Default `{}`. |
| `created_at` | `timestamptz` | no | `now()`. |

**Events:** `feature_view {feature}` (a *granted* view of a gated page; deduped per user + feature per 30 min) · `tv_username_set` (logged inside `fn_set_tradingview_username`) · `upgrade_viewed {region}` · `upgrade_broker_link_clicked {broker, flow}` · `upgrade_contact_clicked {channel}` · `deposit_verified {amount, broker, tier}`. Later phases add `deposit_submitted`, `tier_changed` and `onboarding_step_done`. The allowlist lives in the database and is mirrored in `src/lib/eventNames.ts`.

**Writers.** Every insert goes through `fn_app_event_insert` (allowlist, size cap, dedupe), which no client role can call. It's reached two ways:
- `fn_log_event(p_event, p_props)` — `authenticated`. The user comes from `auth.uid()`, and **only** the two click events are accepted, so a browser can't forge `deposit_verified` or `feature_view`.
- `fn_log_event_as(p_user_id, p_event, p_props)` — `service_role` only. For server code logging a user it has already authenticated: page renders via Next's `after()` (where cookies are unavailable) and admin actions acting on another user.

**Reader.** `fn_admin_funnel_stats(p_days)` — admin-only aggregate for `/stats`: activation rate, upgrade-funnel step counts, conversion split. Aggregates in the database because `app_events` outgrows PostgREST's 1000-row page cap within days.

---

## Table: `growth_daily`

One row per Singapore-time calendar day, written by the daily-stats cron (`/api/cron/daily-stats`, service role) at 09:00 SGT. Aggregate counts only, no member PII. Admins may SELECT; nobody else has access. Defined in `20260625000001_growth_daily.sql`.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `date` | `date` | no | PK. SGT calendar date of the snapshot. |
| `signups_today` / `signups_7d` / `signups_30d` | `integer` | no | Profile rows created in each window. |
| `trials_active` | `integer` | no | Active-status trials still inside their clock. |
| `trials_expiring_48h` | `integer` | no | Active trials falling due within 48h. |
| `conversions_today` | `integer` | no | Deposits verified during the SGT day. |
| `members_active` | `integer` | no | Every `member_active` profile, **legacy included**. Kept for continuity; not a conversion figure. |
| `members_verified` | `integer` | yes | `member_active` with `deposit_verified_at` set: the real conversions. **Null before 2026-09-10** (not measured). Added in `20260910000001_growth_daily_verified_members.sql`. |
| `members_legacy` | `integer` | yes | `member_active` with no deposit record: grandfathered Softr members. **Null before 2026-09-10.** Same migration. |
| `churn_today` | `integer` | no | Profiles downgraded during the SGT day. |
| `tv_engagement_pct` | `numeric` | no | % of all `member_active` profiles (legacy included) with a TradingView username. |
| `broker_split` | `jsonb` | no | Member counts by broker. |
| `narrative` | `text` | yes | The AI growth read for the day. |
| `created_at` | `timestamptz` | no | Row creation time. |

**Rule for new metric columns:** add them nullable. The original columns are `NOT NULL`, so a new `NOT NULL` column would force a fabricated value into every historical snapshot.

**Legacy members.** A *legacy* member is `account_status = 'member_active'` with `deposit_verified_at is null`: one of the 112 grandfathered Softr members migrated in June 2026. They never came through the signup funnel, so conversion metrics exclude them from both the numerator and the denominator (`isLegacyMember()` and `computeConversion()` in `src/lib/growth/metrics.ts`). Conversion-fix task 3.1 replaces this null-semantics rule with an explicit `profiles.grandfathered` flag.

---

## State Machine

```
                 signup
                   |
                   v
            trial_active
              /        \
    (14 days)            (verified $50+ deposit
       |                  + IB confirmed)
       v                       |
  trial_expired                v
       |                 member_active
       |
  (60+ days dormant
   AND trial_count < 2)
       |
       v
  re_trial_active
      /        \
(14 days)       (verified $50+ deposit
    |            + IB confirmed)
    v                  |
re_trial_expired       v
                 member_active
```

### Transitions

| From | To | Trigger |
|---|---|---|
| *(new signup)* | `trial_active` | User signs up. `trial_ends_at` = `signup_at + 14 days`, `trial_count` = 1. |
| `trial_active` | `trial_expired` | `now() > trial_ends_at` and no qualifying deposit. Set `downgraded_at`. |
| `trial_active` | `member_active` | Qualifying deposit verified mid-trial (early upgrade). Set `member_status` = `active`. |
| `trial_expired` | `re_trial_active` | Re-trial granted. See eligibility rules below. `trial_count` bumped to 2, new `trial_ends_at` set, `downgraded_at` cleared. |
| `re_trial_active` | `re_trial_expired` | `now() > trial_ends_at` and no qualifying deposit. Set `downgraded_at`. |
| `re_trial_active` | `member_active` | Qualifying deposit verified mid-re-trial. Set `member_status` = `active`. |

No other transitions exist. `member_active` is a terminal state at launch. `re_trial_expired` is a terminal state (no further trials).

**Admin manual override (added 2026-06-10, Gordon's decision):** the admin dashboard is the single source of truth for member state. `fn_admin_update_member` lets an admin set any *valid* status/broker/trial fields directly, with bookkeeping kept consistent (`member_status`, `downgraded_at`, lapsed trial clocks restart at +14 days). It deliberately bypasses the deposit and re-trial business rules; `fn_verify_deposit` and `fn_grant_retrial` remain the rule-enforced paths for the normal flows.

### Qualifying deposit

A deposit qualifies when ALL of the following are true:
1. `deposit_amount >= 500`
2. `broker` is one of the partnered brokers (`octa`, `dupoin`, `elev8`)
3. `ib_link_confirmed = true` (attributed to our IB link)
4. `deposit_verified_at` is set
5. `deposit_verified_by` is set

### Re-trial eligibility (computed, never stored)

```
eligible = (now() - downgraded_at >= 60 days) AND (trial_count < 2)
```

Only users in `trial_expired` state can be granted a re-trial. Re-trial eligibility is always computed at query time — there is no stored flag.

---

## Content Gating

Access is **tier-based**, derived from `account_status`. Two tiers:

| Access Tier | States | What's accessible |
|---|---|---|
| **Full** | `trial_active`, `member_active`, `re_trial_active` | All content: 8 lead magnets, signals, education modules, tools. |
| **Limited** | `trial_expired`, `re_trial_expired` | Marketing pages, upgrade prompts. Lead magnets locked. |

Access tier is a pure function of `account_status` — no separate entitlements table, no per-asset flags. The app resolves access at render time by checking the user's current `account_status`.

**Important: time-check guard.** For `trial_active` and `re_trial_active`, the access check must also verify `now() < trial_ends_at`. If the trial date has passed, access is **Limited** regardless of the stored `account_status`. This prevents expired trials from retaining full access if the status-update job runs late or fails.

---

## Future-Proofing Notes

1. **Activity-gated membership.** `member_status` and `last_known_trading_activity` are present from day one. At launch, `member_active` grants permanent access. When activity-gating is turned on, the app will check `member_status` (which a background job sets to `inactive` if `last_known_trading_activity` is stale) in addition to `account_status`. No schema migration needed.

2. **Broker expansion.** Adding a new broker means adding a value to the `broker` check constraint — a one-line `ALTER`, no enum type rebuild.

3. **Deposit history.** Done (conversion-fix 3.1/3.2): `deposit_events` records every verified deposit, and `fn_verify_deposit` accepts top-ups from $50, adds each one to `profiles.deposit_amount`, and leaves `deposit_verified_at` at the first verification.

4. **Trial expiry job.** A scheduled job (tomorrow's work) will flip `trial_active` → `trial_expired` and `re_trial_active` → `re_trial_expired` when `trial_ends_at` passes.

---

## What This Schema Does NOT Include

These are explicitly out of scope for today:

- Auth tables (handled by Supabase `auth` schema)
- RLS policies
- Content/curriculum tables
- Email/notification preferences
- Broker postback webhook tables
- Analytics event tables

# MMFX Member App — Database Schema

**Status:** Draft, awaiting approval before any SQL or migrations are written.

---

## Overview

One table — `profiles` — extends Supabase `auth.users` and holds every field needed for the trial/membership state machine, deposit verification, and content gating. No separate deposits table: each user has at most one qualifying deposit, so a join adds complexity without value.

---

## Table: `profiles`

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | `uuid` | — | no | PK. References `auth.users(id)` on delete cascade. |
| `email` | `text` | — | no | Denormalized from `auth.users` for query convenience. |
| `full_name` | `text` | — | yes | Display name. |
| `signup_at` | `timestamptz` | `now()` | no | When the user first signed up. |
| `trial_ends_at` | `timestamptz` | — | yes | Set at signup to `signup_at + 14 days`. Stored, never computed on the fly. **Null for members** — cleared on the flip to `member_active` (2026-06-10). A CHECK guarantees `trial_active`/`re_trial_active` always have a clock. |
| `trial_count` | `integer` | `1` | no | Lifetime trial count. Initial signup = 1, re-trial bumps to 2. Hard cap of 2. |
| `account_status` | `text` | `'trial_active'` | no | One of: `trial_active`, `trial_expired`, `member_active`, `re_trial_active`, `re_trial_expired`. See state machine below. |
| `member_status` | `text` | `'inactive'` | no | `active` or `inactive`. Set to `active` on qualifying deposit. Exists for future activity-gating — not enforced at launch. |
| `last_known_trading_activity` | `timestamptz` | — | yes | Last known trade date from broker data. For future activity-gating. Null until first data received. |
| `broker` | `text` | — | yes | `octa`, `dupoin` or `elev8`. Null until deposit is submitted. |
| `deposit_amount` | `numeric` | — | yes | Dollar amount of verified deposit. Qualifying threshold is $500. |
| `deposit_verified_at` | `timestamptz` | — | yes | When the deposit was verified. Null = no verified deposit. |
| `deposit_verified_by` | `text` | — | yes | `manual`, `broker_postback`, or `webhook`. Launch uses `manual`. |
| `ib_link_confirmed` | `boolean` | `false` | no | Whether the deposit is attributed to our IB link. Separate from deposit amount — a $500 deposit without IB attribution does NOT qualify. |
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
    (14 days)            (verified $500 deposit
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
(14 days)       (verified $500 deposit
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

3. **Deposit history.** If we ever need to track multiple deposits per user (partial deposits, top-ups), a `deposits` table can be added later with a FK to `profiles.id`. The current single-deposit fields on `profiles` would remain as the "qualifying deposit" snapshot.

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

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
| `last_activity_at` | `timestamptz` | — | yes | Last app activity (login, page view). For engagement tracking. |
| `downgraded_at` | `timestamptz` | — | yes | When the user was downgraded. Used in re-trial eligibility computation. Null if never downgraded. Cleared on member upgrade and re-trial grant. |
| `is_admin` | `boolean` | `false` | no | Admin flag (Day 4). Set manually in SQL only, never from the app. Gates the admin SELECT policy and the admin-only functions via `is_admin()`. |
| `tradingview_username` | `text` | — | yes | TradingView handle the user submits to request indicator access (Day 6). Set only by `fn_set_tradingview_username` on the user's own row; indicator granting is manual. |
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

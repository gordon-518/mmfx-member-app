# Trading account number — self-service field + member gate

**Date:** 2026-07-15
**Status:** Approved design — pending plan

## Goal

Collect each trader's live MT4/MT5 **trading account number** so inactive /
switched-account members can be filtered against broker data without accidentally
removing an active trader. Members keep it current; trial users are only prompted.

## Enforcement (tiered by status)

- **Trial** (`trial_active`, `trial_expired`, `re_trial_active`, `re_trial_expired`):
  optional prompt only — a compact top bar with a red/green dot. Never blocks.
- **`member_active`**: **required**. A member with no number saved is hard-gated —
  a focused "add your trading account to continue" screen — and only gets full
  access once they save. Enforced across all member pages (via `requireFull`), so
  they can't sidestep by going straight to another page.
- **Existing ~110 members** hit the gate on their next login (intended — this is
  how their numbers get collected). `member_expired` is not gated (no access).

## Data

- New column `profiles.trading_account_number text`.
- `fn_set_trading_account(p_number text)` — `SECURITY DEFINER`, own-row only
  (`auth.uid()`), pinned search_path. Validation: **digits only, length 4–15**
  (server is source of truth). Mirrors `fn_set_tradingview_username`. Revoke
  anon/public, grant authenticated.
- Add `trading_account_number: string | null` to `AccessProfile`.

## Save flow

- `validateTradingAccount(s): { ok, message }` pure helper (client mirror of the
  4–15-digit rule) in `src/lib/tradingAccount.ts`.
- Server action `setTradingAccount(formData)` in `src/app/dashboard/actions.ts` →
  `rpc fn_set_trading_account` → `revalidatePath('/dashboard')`. Returns a typed
  result for the client (ok / error message).

## UI

- **`TradingAccountBar.tsx`** (client) — compact top bar. Empty: red dot +
  numeric input + Save. Saved: green dot + the number + Update (reveals input).
  Non-blocking. Rendered as the **first block** of `DashboardClient` (above the
  KYS hero) for anyone who is NOT a gated member (i.e. trials, and members who
  already have a number).
- **`TradingAccountGate.tsx`** (client) — full-screen focused blocker (no sidebar)
  for `member_active` + empty: heading "One more step", the description, numeric
  input + Save. On success → `window.location.assign('/dashboard')` (now full).

## Wiring

- `dashboard/page.tsx`: compute
  `needsTradingAccount = profile.account_status === 'member_active' && !profile.trading_account_number`.
  If true → render `<TradingAccountGate/>` standalone (not DashboardClient). Else
  render `DashboardClient` with `tradingAccount` passed for the bar.
- `requireFull.ts`: after the tier check, if
  `profile.account_status === 'member_active' && !profile.trading_account_number`
  → `redirect('/dashboard')` (bounces gated members to the dashboard gate). Trials
  unaffected. `/dashboard` uses `getAccess` (not `requireFull`) so no redirect loop.

## Admin

- Add `trading_account_number` to the admin profiles select + `AdminProfileRow`,
  and a **"Trading acct"** column in the `/admin` user table (next to email /
  country). No admin filter (filtering happens against broker data externally).

## Showcase demo

- The demo account is `member_active` → it would hit the gate. Seed it with a
  trading account number: update `scripts/demo-user.mjs`
  (`trading_account_number = '5001234'`) and patch the live demo row so the
  showcase link isn't stuck on the gate.

## Copy

Use "trading account" (never "broker"). Bar reminder: "Switched trading accounts?
Update this to the one you're most active in." Gate description: keep the account
current so an inactive one doesn't get you removed by mistake.

## Testing

- Unit (TDD): `validateTradingAccount` (rejects <4, >15, non-digits; accepts 4–15
  digits). Server-action guard test (mock rpc + auth).
- DB: fn applied + verified; column exists.
- Preview: trial → optional bar saves + turns green; member-without-number → gate
  blocks, other member pages redirect to it, save → full dashboard; member-with-
  number → green bar + Update; admin column shows; showcase demo not gated.

## Out of scope

- Auto-verifying the number against broker data (stored as-entered; Gordon matches
  externally).
- Filtering the admin list by trading account.

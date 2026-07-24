# Trading Journal — IB attribution & leak prevention

**Date:** 2026-07-20 (rev 2 — after risk review + real export analysis)
**Status:** Approved design — pending plan
**Related:** [[2026-07-06-ai-trading-journal-design]] (journal core),
[[2026-07-15-trading-account-number-design]] (`profiles.trading_account_number`,
consumed here).

## Problem

IB revenue = rebates on the trading volume of accounts **under Gordon's IB code**.
The journal is a premium tool given to those clients. The leak: an account **not
(or no longer) under his IB** connects → Gordon pays ~$5/mo MetaApi and gives a
premium tool away for **zero** rebate. High risk on Elev8/Octa (many IBs, clients
switch); low on Dupoin (few IBs). The broker **server** name can't distinguish IB
(same for all of a broker's clients); the broker Manager API is dead. The only
signal is Gordon's own **periodic IB export** of the account logins under his ID.

## Goals

- Serve the journal only to accounts under Gordon's IB, reconciled against his
  weekly export.
- **Never auto-remove or block a real client** — humans make removal decisions.
- Never block a new signup (open connect; reconcile after).
- Stop MetaApi cost on accounts confirmed not under the IB.

## Non-goals

- Real-time IB verification (no broker API).
- Broker on the profile (stays journal-side).
- More than one journaled account per member (tracks the one declared active
  account).
- The full-app-removal mechanism itself (reuses existing admin user-management).

## Key decisions (locked)

- **Elev8 + Octa are ONE broker** (`elev8_octa`) — shared IB export/downline.
- **Journal is `member_active`-only** → `profiles.trading_account_number` is always
  present (member_active is hard-gated to have it).
- **Only MT5 logins** are connected; `trading_account_number` IS the MT5 login. UI
  states this plainly.
- **Reconcile flags; humans remove.** No automatic removal.

## Real export formats (analysed 2026-07-23 files)

Per-broker parse config (stored on `ib_brokers`, so a format tweak is data not code):

- **Dupoin** — sheet `ReferAccountListExcel`; column **`Account`** = 7-digit numeric
  MT5 login, one per row (~570). Also carries `Name`, `Balance`, `Equity`, `Volume`,
  `Create` → **enrichment comes straight from the file**.
- **Elev8/Octa** — sheet `Sheet1`; column **`trading_account`** = tokens
  `TA<digits>` or `Octa_TA<digits>` (the two brands), **comma-separated, up to 111
  per cell**, ~12,114 tokens across ~3,811 rows. Normalize: strip `Octa_` then `TA`
  → digits; split on comma; trim; dedupe. **No enrichment in file** → enrichment
  from MetaApi (balance/activity) + profile (name). `unique_referrer_id` = Gordon's
  IB id (sanity-check it matches expected).

Parser is **pure + unit-tested** against fixtures derived from both real files.
Build-time safety net: on the first real Octa connect, log whether the login
matched the export (guards the TA-digits = MT5-login assumption).

## Core model — reconcile → report → manual review → manual removal

Gating at connect against a weekly list would lock out Tue–Sun signups, so connect
is open and the **weekly reconcile only flags** — it never removes. It does the
tedious filtering once and hands humans a short list.

1. **Reconcile (automated, on upload):** for each connected journal account whose
   broker has a current export, normalize + check its MT5 login against that week's
   list. Not found → **flagged** (`ib_review = 'flagged'`), not removed.
2. **Review report (downloadable CSV/XLSX):** the flagged set, enriched with
   account number, member name, broker, balance/equity, last-trade date, journal
   status. Handed to an admin.
3. **Admin manual check** against the broker CRM (the human-only step).
4. **Manual removal — two types, chosen per account in the admin UI:**
   - **Type A — inactive but valid** (e.g. dormant, still holds a Dupoin balance,
     broke no rule): **remove MetaApi + block journal access, keep the app account.**
     Journal-owned action. Stops the ~$5/mo without evicting a legit member.
   - **Type B — gone / switched IB:** **remove MetaApi + journal + app access.** The
     journal-side (MetaApi + journal block) is journal-owned; **"remove app access"
     hands off to the existing admin user-management** (`account_status`) — the
     journal offers a "flag for full removal" button that routes there. *(Assumed
     hand-off, not direct trigger — confirm.)*

Because removal is deliberate + human, a flagged-but-legit client is never wrongly
cut off. A blocked/removed account cannot reconnect (the state prevents it). The
flag itself does **not** block — flagged accounts keep working until a human acts,
so there's no reconnect race and no auto-heal machinery needed. Bounded cost: a
non-IB account runs until the next reconcile flags it and a human removes it.

## Data model

**`ib_brokers`** (seeded via migration):

| column | notes |
|---|---|
| `id` | `dupoin` \| `elev8_octa` |
| `display_name` | "Dupoin", "Elev8 / Octa" |
| `enforcement_mode` | `strict` (both, since both have exports) \| `monitor` (fallback) |
| `parse_config` (jsonb) | column name, prefix-strip rules, split-on-comma flag |
| `allowlist_updated_at` | last successful import (staleness signal) |

**`ib_accounts`** — the allowlist (normalized): `broker_id`, `mt5_login` (canonical
digits), unique `(broker_id, mt5_login)`.

**`journal_accounts`** additions: `broker_id` (FK, chosen at connect);
`ib_review` (`ok` default \| `flagged` \| `journal_blocked`). `journal_blocked` is
set only by the manual Type-A action and blocks reconnect.

RLS: new tables + these columns admin/service-role only; traders never write them.

## Connect flow (journal)

`ConnectWizard.tsx` + `POST /api/journal/accounts`:

- **Account number** — read from `profiles.trading_account_number` (member_active
  guarantees it), shown pre-filled, not re-typed.
- **Broker** — required `<select>`: Dupoin / Elev8-Octa. Drives the reconcile.
- **Server** — free text (MetaApi needs the exact string).
- **Investor password** — entered, passed through, never stored.
- **Wrong-broker sanity check:** the entered server string almost always names the
  broker (`Dupoin-…`, `Elev8-…`, `Octa…`). If it clearly contradicts the selected
  broker, warn/reject — closes the "pick the other broker to dodge reconcile" hole.
- Reject reconnect if this account is `journal_blocked`.
- On success: store `broker_id` + `broker_server` + login; provision MetaApi
  (cloud-g1/regular); enqueue initial sync.

## Weekly reconcile + report (admin `/journal/ib`)

One card per broker.

1. **Upload/paste** the week's export (`.xlsx`/`.xls`/CSV). Parser normalizes per
   the broker's `parse_config`.
2. **Parse-review UX:** show parsed count + a **sample of normalized logins** + the
   detected referrer id (Octa) so a mis-parse is caught before commit.
3. **Full-replace** that broker's `ib_accounts` on confirm.
4. **Two guardrails on the diff:** block if the new list would **remove >20%** of
   the current set *or* **add >X%** more than expected (catches both a truncated
   file and a wrong/too-big file) — explicit override to proceed.
5. **Reconcile + report:** connected accounts whose login isn't in the new list →
   set `ib_review='flagged'`; generate the **downloadable enriched report**. Stamp
   `allowlist_updated_at`.
6. **Staleness surface:** per-broker "last updated N days ago" with a warning past
   ~10 days (the system's protection decays if uploads lapse — this is a real
   operational dependency).

Removal is a **separate manual step** (Type A / Type B buttons per flagged account),
never automatic.

## Account-switch handling

Member updates `profiles.trading_account_number` (the one enforced place). On next
journal load, if the connected login ≠ the profile number, disconnect the stale
account and prompt to authorize the new one.

## Testing

- `parseIbExport` (pure): Dupoin numeric col; Octa strip `Octa_`/`TA`, comma-split,
  dedupe; fixtures from both real files incl. the 111-per-cell row.
- Reconcile diff (pure): `{added, removed, flaggedConnected}`; both guardrails fire.
- Connect: reads profile number; rejects `journal_blocked`; server↔broker mismatch
  warns.
- Enforcement: `monitor` broker skipped; `strict` flags.
- Removal: Type A blocks journal + removes MetaApi, keeps app; Type B routes to
  app-removal.

## Rollout-phase enhancements — ⚠️ REMIND GORDON before going live to real members

These are NOT in the admin-only build. Raise them when moving from staged/admin
to real-member rollout.

1. **Member Audit checks (agreed, ready to build on request):** on each export
   upload, also audit `profiles.trading_account_number` for ALL members, not just
   journal-connected accounts:
   - **Not under IB** — registered account isn't in either export → CRM-verify.
   - **Low balance (< $50, configurable)** — member's **Dupoin** account balance is
     under threshold → "balance too low — DM to top up." Requires storing per-account
     `balance` on `ib_accounts` from the Dupoin import (nullable; Octa has no balance).
     Scope to MEMBERS — 90% of the raw 570-account Dupoin book is < $50, so a
     whole-book threshold is meaningless.

2. **Octa balance data (future ask):** request Octa/Elev8 to add a per-account
   balance column to their export → enables low-balance flagging + account-size
   review for Octa members (today balance is Dupoin-only).

3. **Grace-period removals + email reminders (SendPulse) — the go-live upgrade of
   the removal flow.** Today removals are immediate + manual (correct for admin-only
   staging). At rollout, an action (Full removal / Block journal / future actions)
   starts a **7-day grace period** (7 to align with the weekly Monday CSV cadence):
   - Send the member a **daily email** for 7 days (via SendPulse) stating the problem
     + required action (e.g. "no longer under our IB — switch back / rejoin before
     [date] or lose access").
   - **Auto-cancel** if the member **reappears in a later IB export** → removal called
     off, reminders stop.
   - **Auto-execute** the removal at day 7 if still not under the IB.
   - **Email only** (Telegram considered, dropped for simplicity).
   - Needs: a pending-removal/grace table (action, member, deadline, reason), a daily
     job to send reminders + auto-execute/auto-cancel, SendPulse templates.

## Open items

- Confirm Type-B "remove app access" = **hand-off** to admin user-mgmt (assumed).
- Scheduled weekly upload reminder (nudge) — recommended for v1 given the staleness
  dependency; confirm scope.
- Octa TA-digits = MT5-login: confirmed by Gordon; verified again at first real
  Octa connect via the build-time log.

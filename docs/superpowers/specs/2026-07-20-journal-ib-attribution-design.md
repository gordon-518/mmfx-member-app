# Trading Journal — IB attribution & leak prevention

**Date:** 2026-07-20
**Status:** Approved design — pending plan
**Related:** [[2026-07-06-ai-trading-journal-design]] (journal core),
[[2026-07-15-trading-account-number-design]] (the `profiles.trading_account_number`
field this consumes).

## Problem

IB revenue = rebates on the trading volume of accounts **under Gordon's IB code**.
The journal is a premium tool given to those clients. The leak: an account that is
**not (or no longer) under his IB** connects to the journal → Gordon pays ~$5/mo of
MetaApi cost and hands over a premium tool for **zero** rebate.

- **Elev8 / Octa** — high risk. Many IBs exist, so a client can switch their IB
  away from Gordon (or never was his) while still trading the same broker/server.
- **Dupoin** — low risk. Few IBs, so Dupoin clients who sign up through Gordon
  effectively stay his.

The broker **server** name (e.g. `Elev8-Live`) is **the same for every client of
that broker regardless of IB**, so it cannot distinguish Gordon's clients from
another IB's. IB attribution lives in the broker CRM, keyed to the **account
login**. The broker Manager API is dead (both brokers declined server-side
access), so the only signal Gordon can get is a **periodic export of the account
logins under his IB**.

## Goals

- Serve the journal only to accounts **under Gordon's IB** — reconciled against his
  own periodic (weekly) IB export.
- **Never block a real new client** — a Tue–Sun signup must get instant access, not
  wait for the next Monday.
- Detect and remove accounts that **switched their IB away** mid-relationship.
- Stop MetaApi cost the moment an account is confirmed not-under-IB.
- Degrade gracefully per broker: enforce where a reliable export exists (Dupoin
  now), ride along untouched where it doesn't (Elev8/Octa until their export
  arrives), flip between the two with a **toggle, no code change**.

## Non-goals

- Verifying IB attribution in real time (no broker API — impossible).
- Capturing the broker on the member profile (stays on the journal per decision).
- Journaling more than one account per user (the journal tracks the member's one
  declared active account; YAGNI on multi-account).

## Core model — reconcile, don't gate

Gating **at connect** against a weekly list would lock out anyone who signs up
between Mondays. So we invert it: **connect is open; a weekly reconcile removes
accounts not under the IB.** One mechanism covers both a never-a-client leecher and
a client who switched IB away — both are simply "not in this week's export".

The bounded cost tradeoff (accepted): a non-IB account can sit connected up to ~6
days before the next Monday reconcile removes it — a couple dollars of MetaApi cost,
max. Worth it to never block a real client.

## Data model

**`ib_brokers`** — broker registry / enforcement config (seeded via migration):

| column | notes |
|---|---|
| `id` (text, PK) | `dupoin` \| `elev8` \| `octa` |
| `display_name` (text) | "Dupoin", "Elev8", "Octa" |
| `enforcement_mode` (text) | `strict` \| `monitor`. Seed: dupoin=strict, elev8/octa=monitor |
| `allowlist_updated_at` (timestamptz, null) | last successful export import (staleness signal) |

**`ib_accounts`** — the allowlist (the "guest list"), maintained from the weekly
export:

| column | notes |
|---|---|
| `broker_id` (text, FK → ib_brokers) | |
| `mt5_login` (text) | account number under the IB |
| unique | `(broker_id, mt5_login)` |

**`journal_accounts`** — additions to the existing table:

| column | notes |
|---|---|
| `broker_id` (text, FK → ib_brokers, null) | which of the 3 brokers, chosen at connect (drives the reconcile) |
| `ib_status` (text) | `ok` (default) \| `removed_not_ib` (the self-healing blocklist mark) |

RLS: both new tables admin-only (mirror the journal's `requireAdminApi` +
service-role pattern). `ib_status` / `broker_id` on `journal_accounts` are written
only by the service role (connect route + reconcile), never by the trader.

## Connect flow (journal)

UI (`ConnectWizard.tsx`) + `POST /api/journal/accounts`:

- **Account number** — read from `profiles.trading_account_number`, shown
  pre-filled (not re-typed). Enforces "the journal tracks your one registered
  active account." If the member has no number on file, send them to the existing
  trading-account gate first (they can't reach member-active pages without it
  anyway — see the related spec).
- **Broker** — required `<select>`, exactly 3 options (Dupoin / Elev8 / Octa),
  sourced from `ib_brokers`. Lives here, not on the profile. A client cannot pick
  any other broker.
- **Server** — free text (MetaApi requires the exact server string to connect; a
  dropdown would wrongly exclude Elev8/Octa servers we haven't enumerated).
- **Investor password** — entered here, passed through to MetaApi, never stored.

Server-side gate at connect is **minimal by design** (no allowlist check, to avoid
signup lag). The one check: reject if this `(broker_id, mt5_login)` currently
carries `ib_status = 'removed_not_ib'` **and** hasn't since reappeared in an export
— i.e. block a *known-rejected* account from reconnecting in a loop. New logins
have no mark and connect instantly. On success, store `broker_id` + `broker_server`
+ `mt5_login`, provision MetaApi (cloud-g1/regular per the fixed provisioning),
enqueue the initial sync.

## Weekly reconcile (built into the upload)

Admin page **`/journal/ib`** (admin-only), one card per broker.

1. **Upload / paste** that week's export for a broker (CSV or raw). Parser extracts
   MT5 logins (scans for the account-number column / digit tokens; ignores names,
   volume, other columns).
2. **Full-replace** semantics: the upload replaces that broker's `ib_accounts` set
   entirely — this is what makes *leavers* detectable (anyone in last week's set but
   not this week's is gone).
3. **Removal guardrail:** if the new set would drop **>20%** of the broker's current
   `ib_accounts`, block the commit and require an explicit override ("yes, replace
   anyway"). Protects against a truncated/wrong-file paste. First import for a
   broker is exempt (nothing to compare).
4. **Preview diff before acting:** show `N in list · +new · −removed`, and
   critically, the list of **connected journal accounts that are NOT in the new
   list** ("these will be removed: `510044`, `510091`"). Operator clicks
   **Confirm & remove**. This is the review step — the reconcile never acts silently.
5. On confirm: for each connected account not in the list, **disconnect** it (delete
   the MetaApi account so cost stops; existing disconnect path) and set
   `ib_status = 'removed_not_ib'`. Set `allowlist_updated_at = now()`.
6. **Auto-heal:** importing a list that now contains a previously-removed login
   clears its `ib_status` back to `ok`, so a client who (re)joins the IB is no
   longer blocked.

Only **strict** brokers are reconciled. **monitor** brokers (Elev8/Octa until their
export exists) are skipped — their upload card is present but optional/greyed, and
flipping `enforcement_mode` to `strict` (a DB toggle, surfaced in the admin page)
turns their reconcile on with no code change.

The reconcile is **operator-triggered by the upload**, not a silent cron. (A future
scheduled reminder — "upload this week's export" — is out of scope for v1.)

## Account-switch handling

The member updates `profiles.trading_account_number` in the one place already
enforced (their profile). On next journal load, if the connected account's
`mt5_login` ≠ the profile number, the journal disconnects the stale account and
prompts the member to authorize the new one (investor password). Single update
point; the journal follows the profile.

## Enforcement summary

| Broker | Mode (v1) | Connect | Weekly reconcile |
|---|---|---|---|
| Dupoin | `strict` | open (blocklist only) | reconciled + removes non-IB |
| Elev8 | `monitor` | open (blocklist only) | skipped until export → toggle to strict |
| Octa | `monitor` | open (blocklist only) | skipped until export → toggle to strict |

## Integration points

- **Reads** `profiles.trading_account_number` (already live; digits-only 4–15) as
  the journal account number. No broker on the profile — broker is journal-side.
- No change required in the other (web-app) build; this build only consumes the
  field.

## Testing

- Pure parser (`parseIbExport`): extracts logins from messy CSV/paste; ignores
  non-numeric columns; dedupes.
- Reconcile diff (pure): given current allowlist + connected accounts + new list →
  correct `{added, removed, toRemoveConnected}`; the >20% guardrail triggers.
- `ib_status` blocklist: a `removed_not_ib` login is refused at connect; reappearing
  in an export clears the mark.
- Enforcement mode: `monitor` broker is skipped by the reconcile; `strict` is
  enforced.
- Connect gate reads the profile number and rejects a member with none on file.

## Open items / future

- Scheduled reminder to upload the weekly export (v1 is manual).
- Elev8/Octa: pending Gordon obtaining a per-account IB export → flip to strict.
- Optional: surface `allowlist_updated_at` staleness warnings (>10 days) on the
  admin page.

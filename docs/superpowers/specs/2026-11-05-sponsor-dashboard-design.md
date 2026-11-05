# Sponsor dashboard — design

**Date:** 2026-11-05 · **Status:** approved in conversation (Gordon), build starting

## 1. What this is

MMFX runs ads in a country with a broker's money. The broker ("sponsor") wants to see
what it bought: how many new clients MMFX acquired in that country during the deal, and
how they converted. Octa sponsors Malaysia; other brokers sponsor Singapore and
Indonesia, one broker per country at a time.

The build extends the partner dashboard that already serves Ren's agency
(`/partners/<slug>?key=…`, migration `20260925000001_partner_attribution.sql`). A sponsor
is a partner row of `kind = 'sponsor'`. Same link-with-key access, same page shell, same
service-role-only data functions. One person per broker uses it today.

### Decisions taken (Gordon, 4–5 Nov 2026)

| Question | Decision |
|---|---|
| What counts as "acquired through the sponsorship" | **Hybrid.** Headline = every signup from the sponsored country inside the deal window, any channel. "Directly traced" = signups whose first-touch cid is a sponsor-tagged ad. |
| What the broker sees about a person | **Masked rows.** First name + last initial, signup date, country, funnel stage, the ad label if traced. The trading account number appears only once the person has funded **with that broker**, which the broker already holds. Never email, phone, Telegram or TradingView handles. |
| How the broker gets in | **Private link per sponsor**, as Ren's dashboard. Email sign-in and per-person keys are deferred until a broker needs several seats. |
| Sponsor map | **Different brokers per country.** A sponsor holds a list of (country, from, until) windows. A country has one sponsor at a time. |
| Deposits with another broker | **Not shown to the sponsor**, not even as a count. Visible to MMFX in admin only (later). |

## 2. Data model

Migration `20261105000001_sponsor_dashboard.sql`, additive. Rollback dry run on
production before applying, as every attribution migration before it.

- `partners` gains `kind text not null default 'agency' check (kind in ('agency','sponsor'))`
  and `brokers text[]` (each element one of `octa`, `dupoin`, `elev8`; a sponsor must have at
  least one). Octa = `{octa, elev8}` because Elev8 is Octa's brand; Dupoin = `{dupoin}`.
- New `partner_countries (slug → partners on delete cascade, country char(2), since
  timestamptz not null, until timestamptz null, primary key (slug, country, since))`.
  `until` null means open-ended. RLS on, no policies, revoked from anon/authenticated.
- `attribution_touches.source` check widens to include `SPN`. `fn_record_touch` is
  re-created verbatim with the `SPN-` bucket added. `organic_signups_by_cid` is widened to
  `SPN-%` so the brain's weekly report sees sponsor ads with no code change.
- Writers (service role only):
  - `fn_sponsor_set(p_slug, p_brokers text[])` flips an existing partner to `sponsor` and
    sets its brokers. The key itself is still minted or rotated by `fn_partner_create`.
  - `fn_sponsor_window_set(p_slug, p_country, p_since, p_until)` inserts a window. It
    **refuses** a window that overlaps another sponsor's window for the same country, and
    **replaces** overlapping windows of the same sponsor and country. This is the
    "one sponsor per country at a time" rule; it lives in the single writer rather than an
    exclusion constraint because the project has no `btree_gist`.
- Readers (service role only):
  - `fn_sponsor_funnel(p_slug, p_since, p_until)` → one row per (signup week UTC, ad label
    or null): `signups, activated, upgrade_viewed, broker_clicked, submitted, funded,
    deposit_total`. Label null = not traced. The page sums rows for the week table and
    filters label-not-null for the ads table, as Ren's page does.
  - `fn_sponsor_clients(p_slug, p_since, p_until, p_limit, p_offset)` → the masked rows:
    `total, signed_up, country, display, stage, ad_label, account_number, deposit_total`.
    Newest first. `total` is the window count for pagination.

## 3. Attribution and funnel rules

**Cohort:** profiles with `country` in one of the sponsor's windows and `signup_at` inside
that window, intersected with the requested range. Admin accounts are excluded.

**Directly traced:** cohort members whose first-touch `attr_cid` starts with
`SPN-<slug>-`. First touch only (Ren's page needs a second rule because an agency is paid
on it; here the headline is the country and the traced line is informational). The label
is the ad name after the prefix, as written in Ads Manager.

**Cid convention:** `?cid=SPN-<slug>-{{ad.name}}&geo=<ISO-2>&utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}`.
Nothing changes on the marketing site; the `mmfx_attr` cookie already carries any cid.

**Stages**, each a count of cohort members for whom the fact is true at read time:

| Stage | Source of truth |
|---|---|
| signed up | the cohort itself |
| activated | TradingView username set, or Know Your Style completed, or `feature_view` of daily-analysis, or any `onboarding_step_done` (identical to Ren's page) |
| visited upgrade | `app_events.upgrade_viewed` |
| clicked broker link | `upgrade_broker_link_clicked` with `props.broker` in the sponsor's brokers |
| submitted deposit | `deposit_submitted` with `props.broker` in the sponsor's brokers |
| funded | `deposit_verified_at` set **and** `profiles.broker` in the sponsor's brokers |
| deposit $ | `sum(deposit_events.amount)` for funded cohort members, sponsor's brokers only |

A person's **stage** in the client table is the furthest of these reached.

## 4. What the sponsor sees

`/partners/<slug>?key=…` renders `SponsorDashboard` when `kind = 'sponsor'`; agencies
render the existing page untouched.

- Header: sponsor name, the country or countries, the deal window.
- Range control: **Whole deal** (default: earliest window start to now) and last 7 / 30 /
  90 days. The functions intersect any range with the windows, so a range can never reach
  outside the deal.
- Tiles: Signups · Directly traced · Activated · Clicked `<Broker>` link · Funded with
  `<Broker>` · Deposits $.
- "By week" table with every stage, one row per signup week.
- "Your tagged ads" table: label, signups, activated, funded, deposits. Empty state tells
  them how to tag.
- "Clients" table, 50 per page, newest first, with the masked columns from §2. "Download
  CSV" exports the masked table across all pages; the funnel CSV stays available.
- Footer: the definitions above in plain words and the cid template.

English only: the audience is a broker's account manager.

## 5. Access and security

- Same `resolvePartner`: slug + key → row or 404; wrong key and unknown slug are
  indistinguishable. `Partner` gains `kind` and `brokers`.
- Every new function: `security definer`, `set search_path = ''`, revoked from `public,
  anon, authenticated`, granted to `service_role`. Both tables: RLS on, no policies.
- Nothing in any function selects email, phone, Telegram or TradingView handle, IP, or
  deposit screenshots. The trading account number is selected only under the funded-with-
  sponsor condition, inside SQL, so no page bug can widen it.
- `robots: noindex`, `force-dynamic`, server component with no client JS, as today.
- One key per sponsor. Rotating it is `fn_partner_create(slug, name)` again. Per-person
  keys and email sign-in are the Phase 2 path if a broker adds people.

## 6. Configuration and ops

- `scripts/apply-sponsor-dashboard-migration.mjs`: applies the migration through the IPv4
  pooler, then inside a rolled-back transaction proves the grants, that anon and
  authenticated are refused, and that the three sponsor functions answer for a throwaway
  sponsor.
- `scripts/sponsor-setup.mjs <slug> --name "Octa" --brokers octa,elev8 --window MY:2026-11-01`
  mints or rotates the key, sets kind and brokers, writes the windows, and prints the link
  **once**. Repeating it with `--rotate` revokes the old link.
- Setting up Octa needs two facts from Gordon: the deal start date and the contact's
  name for the link. The other two sponsors need their broker, country and start date.

## 7. Testing

- Migration source test (`src/lib/sponsors/migration.test.ts`, the partners pattern): tables,
  columns, the `SPN` widening, every grant, no email column named anywhere in the readers.
- Unit tests for the data layer (`src/lib/sponsors/funnel.ts`): row shaping, totals, week
  and label grouping, stage ordering, range parsing including "whole deal", CSV escaping.
- Page test: wrong key → 404; a sponsor row renders the tiles and the masked table and the
  HTML contains no `@`; an agency row still renders the existing page.
- `tsc --noEmit`, `eslint`, `vitest run` green. Then the production dry run in §6.

## 8. Out of scope, deliberately

Weekly email for sponsors (the partner cron can be widened later) · per-person keys ·
email sign-in · an admin view of "funded elsewhere" · lots traded per sponsored client
(the journal has it for connected accounts) · spend and ROI · translation.

## 9. Rollout

1. PR against `main`; tests green. 2. Dry run, then apply the migration (additive; Ren's
page keeps working because `kind` defaults to `agency`). 3. Merge and deploy. 4. Configure
Octa and send the link. 5. Tag the Malaysian campaigns with the `SPN-octa-` template.

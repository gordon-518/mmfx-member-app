# White-label desk: brand layer + demo tenant

**Date:** 7 Oct 2026
**Status:** approved by Gordon in principle ("start duplicating, build a demo, don't stop"); design decisions below were made by Claude and are open to revision.
**Relates to:** `2026-08-28-dupoin-mib-agency-design.md` (the commercial model: MIB override, MMFX above the IBs, recurring income). This spec is the first slice of what that doc called Spec B.

---

## 1. Goal

Make the member app sellable to other IBs under their own brand, and stand up a
**demo desk** that a prospect can tour today. The demo is what Gordon shows the
IBs who approached him; a domain follows later.

## 2. What can be duplicated (the inventory)

**Group A: software only, no MMFX content inside. Clone, re-point, re-brand.**
Member platform (auth, 14-day trial, free tier, three paid tiers on cumulative
deposits, admin, onboarding), anti-abuse, AI Trading Assistant, Fundamental Desk,
Know Your Style, calendar, news/sentiment, geo-routed upgrade funnel, lifecycle
email rail, Telegram channel automation, support agent, growth stats, link tracker
and partner attribution, organic render engine, guides store, Meta pixel/CAPI,
showcase link.

**Group B: infrastructure duplicates, content is MMFX's to license or withhold.**
Course player, eBook library, daily-analysis publisher, signals hub, live-class
scheduler, Team MM. Shells clone cleanly; the 19 lessons, 4 eBooks, daily
analysis, signals and Team MM stay MMFX-exclusive per the 28 Aug decision. The demo
shows a subset as *sample content*.

**Group C: the white-label wall.** TradingView scripts carry one author name
(resolution: neutral engine brand, "powered by"). Daily analysis, paid ads and
creative are services priced in Don's time. The EA is spec only.

## 3. Architecture: one codebase, brand by environment

Rejected: forking the repo per client (maintenance multiplies with every tenant)
and full multi-tenancy now (weeks of RLS work before a single demo exists).

Chosen: **one repo, one brand module, one deployment per tenant.** Every tenant is
a Vercel project + a Supabase project pointed at the same code, differing only in
environment variables. This is the "branding layer" row of the 28 Aug platform
table, and it is a prerequisite for multi-tenancy later, not a detour from it.

### 3.1 `src/lib/brand.ts`

A single client-safe module. Reads `NEXT_PUBLIC_BRAND_*` at build time with
**MMFX defaults identical to today's hard-coded strings**, so production is
byte-for-byte unchanged until an env var is set.

| Field | Env var | MMFX default |
|---|---|---|
| `name` | `NEXT_PUBLIC_BRAND_NAME` | Market Makers FX |
| `shortName` | `NEXT_PUBLIC_BRAND_SHORT` | MMFX |
| `wordmark` (lead / accent) | `NEXT_PUBLIC_BRAND_WORDMARK` ("Market Makers\|FX") | Market Makers / FX |
| `domain` | `NEXT_PUBLIC_BRAND_DOMAIN` | marketmakersfx.net |
| `supportEmail` | `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL` | hello@marketmakersfx.net |
| `postalLine` | `NEXT_PUBLIC_BRAND_POSTAL` | Market Makers FX, Singapore |
| `persona` | `NEXT_PUBLIC_BRAND_PERSONA` | Don |
| `accent`, `accentSoft`, `accentInk` | `NEXT_PUBLIC_BRAND_ACCENT*` | #ff5a1f, #ffece2, #c2410c |
| `demo` | `NEXT_PUBLIC_BRAND_DEMO` | false |
| `featuresOff` | `NEXT_PUBLIC_BRAND_FEATURES_OFF` (comma list of feature keys) | none |

Broker links gain env overrides (`NEXT_PUBLIC_IB_NUMBER`, `NEXT_PUBLIC_DUPOIN_SIGNUP`)
because under the MIB model every IB's traders open accounts through *that IB's*
link.

### 3.2 Theme

The accent trio is overridden at runtime by inline CSS variables on `<html>` in
the root layout. Tailwind v4 utilities compile to `var(--color-orange)` etc., so
every `bg-orange` / `text-accent-ink` picks the tenant's colour with no class
changes. Fonts stay shared.

### 3.3 Feature toggles

`featuresOff` hides a surface from the nav and makes its route redirect to the
dashboard. This is the 28 Aug constraint "a surface hides unless populated",
done the cheap way (config, not data-driven) for now.

### 3.4 Demo banner and pitch page

When `demo` is true: a slim banner above the shell reads "Demo desk · sample
content · re-branded for you in minutes", and `/` renders a partner-facing pitch
page (adapted from `mib-pack/source-markdown/IB-ONE-PAGER.md`) with a "Tour the
desk" button that goes straight to `/showcase?token=…`. Production keeps its
redirect to `/dashboard`.

### 3.5 Cron hygiene

Cron routes that need credentials the tenant does not have (TradingView,
SendPulse) return 200 "skipped" instead of 500 when the env is absent.

## 4. The demo tenant

| Item | Value |
|---|---|
| Brand | **Summit Desk** (wordmark "Summit" / "Desk"), teal accent `#0d9488` / `#ccfbf1` / `#0f766e` |
| Supabase | project `ib-demo-desk`, ref `bsjtujozcqbdqlmuturu`, Sydney. All migrations applied with the new `scripts/migrate-fresh.mjs` (runs the folder in order against any DB URL; reusable for every future tenant) |
| Vercel | project `ib-demo-desk`, deployed from the `feat/white-label-brand` branch via a git worktree. Custom domain added when Gordon supplies one |
| Features off | library, signals, team-mm (MMFX-exclusive or empty) |
| Seeded | demo member Alex Rivera (showcase link); demo admin for the back-office tour; 90-day journal history; 3 sample daily analyses; 2 upcoming live classes; 30 days of growth snapshots |
| Shared keys | Forex news, Anthropic, MetaApi reused from MMFX (Gordon's own accounts). Email lifecycle off. Telegram off. TradingView off |

## 5. Rollout

The brand refactor ships as a PR to `main`; Gordon merges (production behaviour is
unchanged, tests prove the defaults). The demo deploys from the branch immediately
and is re-pointed to `main` after merge.

## 6. Out of scope (next slices)

Multi-tenant single database, upload-and-publish studio, neutral TradingView
engine brand, the short neutral course, per-tenant email sender domains, sub-IB
volume reporting.

# Dupoin MIB — IB Infrastructure Agency

**Date:** 28 Aug 2026
**Scope:** A — the broker proposal pack. Specs B (platform build) and C (delivery ops) are out of scope and deliberately deferred.
**Status:** design approved, pack not yet written.

---

## 1. Context

Dupoin has proposed a Master IB (MIB) arrangement: the broker sources IBs who sit under
MMFX's MIB, MMFX supplies them with marketing, product and lead-generation services, and
MMFX earns a per-lot override on volume generated across the downline (illustrative: $2/lot).

The customer is therefore **the sub-IB, not the retail trader**, and revenue is a volume
override rather than a service fee. That inverts the usual agency economics and dictates
everything below.

### Decisions taken (28 Aug 2026)

| Decision | Choice | Consequence |
|---|---|---|
| Delivery model | **White-label** — each IB gets their own branded desk | Requires real multi-tenancy; blocks a same-day launch |
| Content layer | **The IB supplies their own content** | MMFX is infrastructure, not a franchise; adds the Tenant Studio build |
| Three feasibility conditions | **Accepted in full** | See §8 — all three are contractual preconditions, not aspirations |

### Positioning

**Infrastructure for forex IBs.** Not an agency retainer, not a content franchise — the
platform, tooling and funnel that turn a sub-IB with an audience into a sub-IB with a
product. Closest analogue: Shopify for IBs.

This positioning is chosen deliberately over a franchise model because it does not compete
with Dupoin's IBs for brand equity, which makes it far easier for the broker to approve.

---

## 2. The value model

Every service in the catalog must move one of three terms:

```
Volume  =  funded accounts  x  lots per account per month  x  months the account stays alive
           |__ lead gen __|     |____ product/engagement ____|   |______ retention ______|
```

Most MIBs sell only the first term — banners, links, "marketing support". MMFX's
differentiator is the third: a desk that keeps traders educated, engaged and alive.
Dead accounts generate zero lots. **Retention is the argument that justifies an override
rather than a flat fee, and it must be the spine of the proposal.**

Sanity anchor (illustrative, to be replaced with negotiated figures):
20 sub-IBs x 50 funded traders x 5 lots/month x $2/lot = **$10k/month**.
This figure determines whether Tier 3 (§6) can ever cover its cost base.

---

## 3. Product boundary

The single most important table in the pack. It sets expectations and prevents the
proposal from over-promising.

**MMFX provides — automated, works on day one, no human input required:**

1. 10 TradingView indicators + 2 strategies, with automated invite-only grant/revoke
2. AI Trading Assistant — read-only MT4/MT5 connect, auto trade import, behavioural leak
   analysis in dollars, discipline score, AI coach
3. Fundamental Desk bot — macro Q&A on gold, emails a PDF thesis
4. Know Your Style — trader archetype quiz, emails the result
5. Economic calendar
6. News + sentiment across 19 instruments
7. Member dashboard + spotlight
8. Signup -> 7-day full-access trial -> geo-routed upgrade funnel
9. Lifecycle email with automatic list sync by account status
10. Telegram channel automation + CTA rotation
11. Anti-abuse — signup fingerprinting, IP capture, trial-farm detection
12. Growth stats dashboard + daily snapshot
13. Admin member management + access grants
14. Link tracker + UTM / creative-ID convention

**The IB provides — their brand, their voice:** course/curriculum, eBooks, daily analysis
(video + PDF), signals, live classes, VIP tier feed.

**Fourteen automated systems against six content surfaces.** An IB with no content still
launches with a desk carrying AI journaling, a full indicator suite, a macro bot, a
calendar, news, and a working trial-to-funded funnel.

### Known risk, accepted

The six content surfaces are the retention half, and most IBs will not sustain a daily
analysis habit. If they sit empty, engagement decays and the override decays with it.

**Mitigation (no strategy change required):** the platform must be built so an optional
shared content feed can be switched on per tenant later, without a refactor. The decision
to use it is deferred; the capability is not.

### The white-label wall

Three things do not white-label, and the pack must say so plainly rather than be caught
out later:

1. **TradingView scripts.** The indicators are invite-only scripts published under one
   TradingView account, and the author name renders on the chart. They cannot be per-IB
   branded. Resolution: publish the suite once under a neutral engine brand; each IB's
   desk reads "powered by <engine>".
2. **Per-tenant running cost.** MetaApi bills per connected account, plus news API, video
   hosting, email and database. Fine at 3 tenants; must be modelled at 30. This cost is
   carried before any lots are traded.
3. **Support load.** Every IB's traders become MMFX's support queue — TradingView grant
   failures, MetaApi connection errors, billing.

---

## 4. Service catalog

Four lines. Each entry in the pack carries a status marker from §7.

**Line 1 — Lead generation.** Meta paid ads (full-funnel, geo-tiered, restricted-category
compliant); AI creative production line (brief -> reference library -> finished stills and
video); TikTok/short-form; Telegram growth; organic content engine; lead magnets (quiz,
eBooks, front-end course); creative refresh cadence; ad-account resilience.

**Line 2 — Lead capture and tracking.** Landing page library; UTM + creative-ID
convention; pixel + Conversions API; signup-trial-funded funnel; lifecycle email; link
tracker; anti-abuse; growth dashboard; per-IB attribution.

**Line 3 — Products.** The fourteen automated systems in §3, licensed into each tenant.

**Line 4 — IB enablement and retention.** The desk as the IB's retention layer; IB
onboarding kit (swipe files, pitch deck, objection handling, compliance rules); sub-IB
portal (their leads, funnel, volume, payout); trader-survival reporting to the broker;
compliance guardrails enforced across every tenant.

Line 4 exists because it is the term of the value equation that justifies the override,
and it costs almost nothing incremental once the platform exists.

---

## 5. Capability register

The pack must split every claim three ways. Nothing ships in the "live" column that
cannot be demonstrated on request.

**Live today** — member app (auth, trial gating, tiers, admin); TradingView auto-grant and
revoke; AI Trading Assistant; Fundamental Desk; Know Your Style; calendar; news; daily
analysis publishing pipeline (MMFX-operated, not yet self-serve); Telegram channel automation; SendPulse lifecycle sync;
anti-abuse; growth stats with daily snapshot; link tracker; geo-routed upgrade; broker
export parser with per-account allowlist and balance matching; landing page library; UTM
and creative-ID convention; compliance framework; AI creative production line.

**Build required** — multi-tenancy (tenant scoping across the schema plus an RLS rewrite);
Tenant Studio (self-serve authoring for all six content surfaces); sub-IB attribution and
reporting; IB-facing portal; Conversions API; TikTok pipeline; ad-account structure for
multi-tenant media buying.

**Not built — do not date it in the proposal** — the MT5 XAUUSD EA. Specified only.

---

## 6. Tiers

**Tier 1 — Equip.** Free to the IB. Platform, tools, funnel and retention layer; the IB
supplies content. Zero marginal cost beyond per-tenant infrastructure, funded entirely by
the override. The default, and near-frictionless to accept.

**Tier 2 — Equip + Capture.** Tier 1 plus their own landing pages, tracking, lifecycle
email and lead dashboard. Small per-IB build.

**Tier 3 — Full agency.** Tier 2 plus MMFX runs paid media. **Ad spend must be funded by
the IB or co-funded by the broker** — see §8, condition 2. This is the tier to negotiate
hardest; it is where the model either prints or bleeds.

---

## 7. The Tenant Studio

Under IB-supplied content, every publishing path that MMFX currently performs by hand must
become self-serve and tenant-scoped. This is a second build sitting on top of
multi-tenancy, and it is the difference between white-label as a slide and white-label as
a product.

| Surface | Today | Needed |
|---|---|---|
| Daily analysis | day.json + locked builders + publish script | Publish UI, per-tenant video hosting, PDF generation from template |
| Course | content tables + private slide buckets | Lesson/module upload UI, per-tenant storage |
| eBooks | Private bucket + gated API route | Upload UI |
| Signals | Telegram automation (MMFX's own) | Per-tenant channel binding + compose UI |
| Live classes | Schedule table | Schedule editor |
| VIP tier | Tier gate (exists) | Configuration only |

Detailed design belongs to Spec B.

---

## 8. Commercial ask and preconditions

### What MMFX asks Dupoin for

- Override rate per lot on downline volume, by tier
- Data access (see conditions below), with a defined refresh cadence
- Term, renewal and any exclusivity
- **Trader portability on termination** — if the arrangement ends, what happens to traders
  MMFX acquired and retained. This must be settled in writing up front, not later.
- Position on co-funding ad spend for Tier 3

### The three preconditions (agreed 28 Aug 2026)

1. **Sub-IB-level volume reporting.** The existing parser already ingests Dupoin's
   `ReferAccountListExcel` (Account + Balance) and matches MT5 logins to members
   (`supabase/migrations/20260720000001_journal_ib_attribution.sql`). What is missing is a
   sub-IB identifier and lots traded. Without it, attribution, pricing and proof of value
   are all impossible. **Confirm in writing before any platform work begins.**
   Also request Dupoin's **baseline account survival and attrition figures** — without a
   baseline, the retention thesis in §2 cannot be proven, only asserted.
2. **Ad spend funded by someone other than MMFX** for any IB where MMFX runs media. The
   override is paid after volume; spend is paid before.
3. **A per-tenant cost floor and minimum-volume threshold**, with a "produce or be
   archived" clause in every IB agreement. A tenant that produces nothing costs money
   every month.

---

## 9. Phasing

Deliberately sequenced so that no platform money is spent on an unproven thesis.

**Phase 0 — now.** Deliver the pack. Secure the three preconditions in writing.

**Phase 1 — pilot, 60-90 days.** Two to three sub-IBs feed the **existing MMFX desk on a
co-brand basis**. No platform build. White-label does not exist yet, and the pilot's job is
to prove the volume and retention thesis and to validate that Dupoin's data actually flows.
**This must be framed to the broker explicitly as a pilot, not as the product** — otherwise
the co-brand shape will be mistaken for a broken promise.

Pilot success metrics: funded accounts per IB; lots per funded account per month;
90-day account survival versus Dupoin's baseline; trial-to-funded conversion; CAC where
paid media is used.

**Phase 2 — build.** Multi-tenancy -> Tenant Studio -> sub-IB attribution and reporting ->
IB portal. Pilot IBs migrate onto their own branded desks. Months of work; starts only if
Phase 1 clears.

**Phase 3 — scale.** Onboard beyond the pilot cohort against the cost floor from §8.

---

## 10. Deliverable

A pack in the shape of the existing `agency-pack` (which briefs an agency *on* MMFX; this
one pitches MMFX *as* the agency), reusing its structure and much of its substance.

| # | File | Contents |
|---|---|---|
| 00 | START-HERE | Reading order, the 60-second version, the five things that bite |
| 01 | THE-OFFER | Positioning, the value model (§2), tiers (§6) |
| 02 | PRODUCT-BOUNDARY | §3 — what MMFX provides, what the IB provides, the white-label wall |
| 03 | SERVICE-CATALOG | §4, every entry status-marked from §5 |
| 04 | CAPABILITY-REGISTER | §5 — live / build required / not built |
| 05 | COMMERCIAL | §8 — the ask, the three preconditions, portability |
| 06 | PHASING | §9 — pilot design and success metrics |
| 07 | COMPLIANCE | Adapted from the existing `05-COMPLIANCE.md` |
| — | IB-ONE-PAGER | Separate sub-IB-facing summary (see assumption A1) |

Markdown source plus PDF, matching the existing pack's build path.

**Audience discipline:** broker-facing materials may discuss override economics, since
Dupoin sets those rates. The sub-IB-facing one-pager must not expose per-lot payouts,
the US/UK lifetime price, or raw IB links — consistent with the existing compliance rules.

---

## 11. Assumptions and open questions

- **A1.** The pack includes a sub-IB-facing one-pager alongside the broker-facing
  documents, on the assumption Dupoin will ask "what will you actually show my IBs?"
  Drop it if the broker conversation is purely commercial.
- **A2.** The override figure stays illustrative ($2/lot) until Dupoin names a number.
- **A3.** The neutral engine brand for the TradingView layer (§3) is unnamed. Needed
  before Phase 2, not before the pack.
- **Q1.** Does Dupoin expect exclusivity — and would that conflict with the existing
  Octa/Elev8 routing for MY/ID?
- **Q2.** Who is the counterparty on the IB agreement — MMFX and the IB directly, or does
  Dupoin contract the IB?

---

## 12. Out of scope

- **Spec B — multi-tenant platform build.** Tenant scoping, RLS rewrite, Tenant Studio,
  attribution pipeline, IB portal. Begins only after §8 condition 1 clears.
- **Spec C — delivery operations.** Ad-account and Business Manager structure, creative
  production cadence, support model, per-tenant cost model.

---

## 13. Success criteria for this spec

The pack is done when a reader at Dupoin can, without asking a follow-up question, state:
what MMFX provides, what the IB must provide, what exists today versus what will be built,
what MMFX is asking for, what Dupoin must supply, and what the first 90 days look like.

# Dupoin MIB — IB Infrastructure Agency

**Date:** 28 Aug 2026 (rev. 2)
**Scope:** A — the broker proposal pack. Specs B (platform build) and C (delivery ops) are out of scope and deliberately deferred.
**Status:** design in review, pack not yet written.

---

## 1. Context

Dupoin has proposed a Master IB (MIB) arrangement: the broker sources IBs who sit under
MMFX's MIB, MMFX supplies them with marketing, product and lead-generation services, and
MMFX earns a per-lot override on volume generated across the downline (illustrative:
$2/lot).

The customer is therefore **the sub-IB, not the retail trader**, and revenue is a volume
override rather than a service fee. That inverts the usual agency economics and dictates
everything below.

### Decisions taken (28 Aug 2026)

| Decision | Choice | Consequence |
|---|---|---|
| Delivery model | **White-label** — each IB gets their own branded desk | Requires multi-tenancy before launch |
| Content and products | **Shared across all tenants, produced by MMFX, re-branded per desk** | No per-tenant authoring needed; content load sits with MMFX |
| Video layer | **Faceless** — chart-only screen capture with voiceover | One production run serves every desk |
| Pilot | **Real white-label from day one**, minimum 3 IBs | Platform is built before the thesis is proven |
| Three feasibility conditions | **Accepted in full** | See §8 — contractual preconditions, not aspirations |

### Positioning

**Infrastructure for forex IBs.** Not an agency retainer and not a franchise — the
platform, product suite, content and funnel that turn a sub-IB with an audience into a
sub-IB with a product, under the IB's own brand. Closest analogue: Shopify for IBs.

Chosen deliberately over a franchise model because it does not compete with Dupoin's IBs
for brand equity, which makes it materially easier for the broker to approve.

---

## 2. The value model

Every service must move one of three terms:

```
Volume  =  funded accounts  x  lots per account per month  x  months the account stays alive
           |__ lead gen __|     |____ product/engagement ____|   |______ retention ______|
```

Most MIBs sell only the first term — banners, links, "marketing support". MMFX's
differentiator is the third: a desk that keeps traders educated, engaged and alive. Dead
accounts generate zero lots. **Retention is what justifies an override rather than a flat
fee, and it must be the spine of the proposal.**

Sanity anchor (illustrative, to be replaced with negotiated figures):
20 sub-IBs x 50 funded traders x 5 lots/month x $2/lot = **$10k/month**.
This figure determines whether Tier 3 (§6) can ever cover its cost base.

---

## 3. Product boundary

The single most important table in the pack. Under the shared-content decision, MMFX
carries the product *and* the content; the IB carries the market.

**MMFX provides — the entire desk, re-branded per tenant:**

*Automated systems (no human input, live on day one)*
1. 10 TradingView indicators + 2 strategies, automated invite-only grant/revoke
2. AI Trading Assistant — read-only MT4/MT5 connect, auto trade import, behavioural leak
   analysis in dollars, discipline score, AI coach
3. Fundamental Desk bot — macro Q&A on gold, emails a PDF thesis
4. Know Your Style — trader archetype quiz
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

*Produced content (shared catalog, re-branded per tenant)*
15. MM Mentorship — 19 lessons / 6 modules, slide-based video + gated decks
16. eBook library — 4 titles
17. Daily XAU/USD analysis — faceless video + branded PDF
18. Signals — 3-5 calls/day, 1:2+ R:R, per-tenant Telegram channel
19. Live classes — 2/week, screen-share format
20. VIP / Team tier feed

**The IB provides:** their audience and traffic, their brand identity, their market and
language, local trader support, and compliance within their jurisdiction. Optionally their
own content later — supported, but not required to launch.

### Risks this creates, accepted

- **Content is now a single point of failure across every tenant.** If MMFX stops
  producing, every desk goes stale simultaneously. Under the previous IB-supplied model
  the risk was distributed; it is now concentrated. Argues for buffered content and a
  documented production cadence (Spec C).
- **Same content across competing IBs.** Two IBs in the same market (MY/ID especially)
  will serve identical analysis to overlapping audiences. Faceless video reduces the
  signal but does not remove it. Consider market or channel exclusivity per tenant.

### The white-label wall

Four things do not white-label cleanly. The pack must say so plainly rather than be caught
out later:

1. **TradingView scripts.** The indicators are invite-only scripts published under one
   TradingView account, and the author name renders on the chart. They cannot be per-IB
   branded. Resolution: publish the suite once under a neutral engine brand; each desk
   reads "powered by <engine>".
2. **Voice.** Faceless removes the face, not the voice. Across tenants the narration is
   identifiably the same person. Either accept it, or move to per-tenant synthesised
   narration later (see A3).
3. **Per-tenant running cost.** MetaApi bills per connected account, plus news API, video
   hosting, email and database. Fine at 3 tenants; must be modelled at 30. Carried before
   any lots are traded.
4. **Support load.** Every IB's traders become MMFX's support queue — TradingView grant
   failures, MetaApi connection errors, billing.

---

## 4. Service catalog

Four lines. Each entry in the pack carries a status marker from §5.

**Line 1 — Lead generation.** Meta paid ads (full-funnel, geo-tiered, restricted-category
compliant); AI creative production line (brief -> reference library -> finished stills and
video); TikTok/short-form; Telegram growth; organic content engine; lead magnets (quiz,
eBooks, front-end course); creative refresh cadence; ad-account resilience.

**Line 2 — Lead capture and tracking.** Landing page library; UTM + creative-ID
convention; pixel + Conversions API; signup-trial-funded funnel; lifecycle email; link
tracker; anti-abuse; growth dashboard; per-IB attribution.

**Line 3 — Products and content.** Items 1-20 in §3, licensed and re-branded into each
tenant.

**Line 4 — IB enablement and retention.** The desk as the IB's retention layer; IB
onboarding kit (swipe files, pitch deck, objection handling, compliance rules); sub-IB
portal (their leads, funnel, volume, payout); trader-survival reporting to the broker;
compliance guardrails enforced across every tenant.

Line 4 exists because it is the term of the value equation that justifies the override,
and it costs almost nothing incremental once the platform exists.

---

## 5. Capability register

Every claim in the pack splits three ways. Nothing ships in the "live" column that cannot
be demonstrated on request.

**Live today** — member app (auth, trial gating, tiers, admin); TradingView auto-grant and
revoke; AI Trading Assistant; Fundamental Desk; Know Your Style; calendar; news; daily
analysis publishing pipeline (MMFX-operated); Telegram channel automation; SendPulse
lifecycle sync; anti-abuse; growth stats with daily snapshot; link tracker; geo-routed
upgrade; broker export parser with per-account allowlist and balance matching; 19-lesson
course; 4 eBooks; landing page library; UTM and creative-ID convention; compliance
framework; AI creative production line.

**Build required** — multi-tenancy (tenant scoping on member data plus an RLS pass);
branding layer (theme, domain, email sender, video watermark, PDF and deck templating);
per-tenant funnel config; tenant-scoped admin and stats; sub-IB attribution and reporting;
IB-facing portal; Conversions API; TikTok pipeline; ad-account structure for multi-tenant
media buying; faceless conversion of the daily-analysis recording habit.

**Not built — do not date it in the proposal** — the MT5 XAUUSD EA. Specified only.

---

## 6. Tiers

**Tier 1 — Equip.** Free to the IB. Full branded desk: platform, products, content and
funnel. Zero marginal cost beyond per-tenant infrastructure, funded entirely by the
override. The default, and near-frictionless to accept.

**Tier 2 — Equip + Capture.** Tier 1 plus their own landing pages, tracking, lifecycle
email and lead dashboard. Small per-IB build.

**Tier 3 — Full agency.** Tier 2 plus MMFX runs paid media. **Ad spend must be funded by
the IB or co-funded by the broker** — see §8, condition 2. The tier to negotiate hardest;
where the model either prints or bleeds.

---

## 7. Platform shape

Shared content collapses most of what a per-tenant authoring studio would have required.
Content tables stay **global**; only member-scoped data is tenant-scoped.

| Layer | Today | Needed |
|---|---|---|
| Tenancy | Single tenant | `tenants` table; `tenant_id` on profiles, journal, quiz, engagement; RLS pass on member data |
| Branding | MMFX hard-coded | Per-tenant theme tokens, logo, custom domain (Vercel wildcard), email sender |
| Content | Global, MMFX-branded | Stays global; brand applied at render — video watermark, PDF tokens, deck re-template from source PPTs |
| Funnel | Single broker routing | Per-tenant broker routing, IB links, trial length, upgrade copy |
| Telegram | One channel | Per-tenant channel binding |
| Email | One SendPulse list | Per-tenant list + sender identity |
| Admin/stats | Global | Tenant-scoped views; MMFX retains a cross-tenant super-admin |
| TradingView | MMFX-branded scripts | Neutral engine brand; grant flow works unchanged |

Detailed design belongs to Spec B.

---

## 8. Commercial ask and preconditions

### What MMFX asks Dupoin for

- Override rate per lot on downline volume, by tier
- Data access (see conditions), with a defined refresh cadence
- Term, renewal and any exclusivity
- **Trader portability on termination** — if the arrangement ends, what happens to traders
  MMFX acquired and retained. Settled in writing up front, not later.
- Position on co-funding ad spend for Tier 3

### The three preconditions (agreed 28 Aug 2026)

1. **Sub-IB-level volume reporting.** The existing parser already ingests Dupoin's
   `ReferAccountListExcel` (Account + Balance) and matches MT5 logins to members
   (`supabase/migrations/20260720000001_journal_ib_attribution.sql`). Missing: a sub-IB
   identifier and lots traded. Without it, attribution, pricing and proof of value are
   impossible. **Confirm in writing before platform work begins.** Also request Dupoin's
   **baseline account survival and attrition figures** — without a baseline the retention
   thesis in §2 can be asserted but never proven.
2. **Ad spend funded by someone other than MMFX** for any IB where MMFX runs media. The
   override is paid after volume; spend is paid before.
3. **A per-tenant cost floor and minimum-volume threshold**, with a "produce or be
   archived" clause in every IB agreement. A tenant that produces nothing costs money
   every month.

Because the pilot now builds the platform *before* proving the thesis (§1), these
preconditions carry more weight, not less. Condition 1 in particular gates the build.

---

## 9. Phasing

**Phase 0 — now.** Deliver the pack. Secure the three preconditions in writing. Confirm
the course videos are genuinely faceless (slide-based) — this is assumed in §3 and changes
the content cost materially if wrong.

**Phase 1 — build the pilot platform.** Multi-tenancy on member data, branding layer,
per-tenant funnel config, tenant-scoped admin and stats, neutral engine brand for the
TradingView suite, faceless daily-analysis production. Scope is bounded by §7 — no
per-tenant authoring.

**Phase 2 — pilot, minimum 3 IBs, 60-90 days.** Three branded desks live, same content
underneath. Success metrics: funded accounts per IB; lots per funded account per month;
90-day account survival versus Dupoin's baseline; trial-to-funded conversion; CAC where
paid media is used.

**Phase 3 — scale.** Onboard beyond the pilot cohort against the cost floor in §8, and
build the deferred items in §5 (attribution reporting, IB portal, CAPI).

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
| 06 | PHASING | §9 — build, pilot design, success metrics |
| 07 | COMPLIANCE | Adapted from the existing `05-COMPLIANCE.md` |
| — | IB-ONE-PAGER | Separate sub-IB-facing summary (see A1) |

Markdown source plus PDF, matching the existing pack's build path.

**Audience discipline:** broker-facing materials may discuss override economics, since
Dupoin sets those rates. The sub-IB-facing one-pager must not expose per-lot payouts, the
US/UK lifetime price, or raw IB links — consistent with the existing compliance rules.

---

## 11. Assumptions and open questions

- **A1.** The pack includes a sub-IB-facing one-pager alongside the broker-facing
  documents, assuming Dupoin will ask "what will you actually show my IBs?" Drop it if the
  conversation is purely commercial.
- **A2.** The override figure stays illustrative ($2/lot) until Dupoin names a number.
- **A3.** Narration stays in Don's voice for the pilot. Per-tenant synthesised narration is
  a Phase 3 option, not a launch requirement.
- **A4.** The 19 course lessons are slide-based with voiceover and contain no on-camera
  presenter, so re-branding is deck re-templating plus a Gumlet watermark rather than
  re-shooting. **Verify in Phase 0.**
- **A5.** The neutral engine brand for the TradingView layer is unnamed. Needed before
  Phase 1 ships, not before the pack.
- **Q1.** Does Dupoin expect exclusivity — and would that conflict with the existing
  Octa/Elev8 routing for MY/ID?
- **Q2.** Who is the counterparty on the IB agreement — MMFX and the IB directly, or does
  Dupoin contract the IB?
- **Q3.** Is any per-tenant market or channel exclusivity offered, given shared content
  across competing IBs (§3)?

---

## 12. Out of scope

- **Spec B — multi-tenant platform build.** Tenancy, RLS, branding layer, funnel config,
  attribution pipeline, IB portal. Begins only after §8 condition 1 clears.
- **Spec C — delivery operations.** Ad-account and Business Manager structure, content
  production cadence and buffering, support model, per-tenant cost model.

---

## 13. Success criteria for this spec

The pack is done when a reader at Dupoin can, without asking a follow-up question, state:
what MMFX provides, what the IB must provide, what exists today versus what will be built,
what MMFX is asking for, what Dupoin must supply, and what the first 90 days look like.

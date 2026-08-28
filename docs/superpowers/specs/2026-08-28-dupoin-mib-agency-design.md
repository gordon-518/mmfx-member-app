# Dupoin MIB — IB Infrastructure Agency

**Date:** 28 Aug 2026 (rev. 3)
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
| MMFX's content contribution | **Tools + one short course**, neutral-branded and faceless, shared across tenants | Small, one-off production; no ongoing content dependency |
| The IB's content | **Optional, uploaded by them** into the platform | Revives an upload-and-publish studio; desks may ship tools-only |
| Video hosting | **Link-only** — the IB brings their own host | Smallest Phase 1 build; no DRM or moderation pipeline |
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

The single most important table in the pack. MMFX supplies the machine; the IB supplies
the market, and optionally the content that runs on it.

**MMFX provides — the full tool suite, re-branded per tenant:**

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
15. **One short course** — neutral-branded, faceless, shared by every tenant

**The IB optionally uploads:** their own course, eBooks, analysis, signals and class
schedule. Nothing is required to launch — a desk that uploads nothing ships as tools plus
the short course, which is still a real product, because the retention engine is the AI
Trading Assistant rather than a content library.

**Stays MMFX-exclusive — not part of the white-label offer:** the 19-lesson MM Mentorship,
the 4 eBooks, daily XAU/USD analysis, the signals desk, live classes, Team MM.

### Design constraints this creates

- **Per-tenant feature toggles are mandatory.** An empty Signals tab reads worse than no
  Signals tab. Every content surface hides unless the tenant has populated it.
- **The short course must be foundational, not the edge.** It should teach market basics
  and platform orientation, not the MM System's actual entry model. Shipping the method
  into every competing IB's desk would arm them with the one thing that is genuinely
  MMFX's.
- **Content moderation is now MMFX's exposure.** IB-uploaded material renders on a
  platform MMFX operates, on a domain MMFX provisions, to traders funnelled to a broker
  where MMFX is the MIB. An IB promising guaranteed returns creates liability for MMFX and
  for Dupoin. Requires a content policy in the IB agreement, a takedown mechanism, and —
  at three tenants — manual pre-publish review.

### The white-label wall

Three things do not white-label cleanly. The pack must say so plainly rather than be
caught out later:

1. **TradingView scripts.** The indicators are invite-only scripts published under one
   TradingView account, and the author name renders on the chart. They cannot be per-IB
   branded. Resolution: publish the suite once under a neutral engine brand; each desk
   reads "powered by <engine>".
2. **Per-tenant running cost.** MetaApi bills per connected account, plus news API, email
   and database. Fine at 3 tenants; must be modelled at 30. Carried before any lots are
   traded. Link-only video hosting keeps this cost flat.
3. **Support load.** Every IB's traders become MMFX's support queue — TradingView grant
   failures, MetaApi connection errors, billing.

The short course carries Don's narration across every tenant. One-off and low-signal, but
noted; per-tenant synthesised narration is a Phase 3 option (A3).

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

**Line 3 — Products.** Items 1-15 in §3, licensed and re-branded into each tenant, plus
the upload-and-publish studio the IB uses for their own content.

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
upgrade; broker export parser with per-account allowlist and balance matching; landing
page library; UTM and creative-ID convention; compliance framework; AI creative production
line.

**Build required** — multi-tenancy (tenant scoping on member data plus an RLS pass);
branding layer (theme, domain, email sender, PDF tokens); per-tenant funnel config;
per-tenant feature toggles; upload-and-publish studio (link-only video, PDF and deck
upload); tenant-scoped admin and stats; content policy and takedown mechanism; **the short
course, produced neutral-branded and faceless**; sub-IB attribution and reporting;
IB-facing portal; Conversions API; TikTok pipeline; ad-account structure for multi-tenant
media buying.

**Not built — do not date it in the proposal** — the MT5 XAUUSD EA. Specified only.

---

## 6. Tiers

**Tier 1 — Equip.** Free to the IB. Full branded desk: the tool suite, the short course,
the funnel, and the studio for uploading their own content. Zero marginal cost beyond per-tenant infrastructure, funded entirely by the
override. The default, and near-frictionless to accept.

**Tier 2 — Equip + Capture.** Tier 1 plus their own landing pages, tracking, lifecycle
email and lead dashboard. Small per-IB build.

**Tier 3 — Full agency.** Tier 2 plus MMFX runs paid media. **Ad spend must be funded by
the IB or co-funded by the broker** — see §8, condition 2. The tier to negotiate hardest;
where the model either prints or bleeds.

---

## 7. Platform shape

Content tables carry a nullable `tenant_id`: **null means global** (the short course,
visible to every desk), **set means tenant-owned** (whatever the IB uploaded). One schema,
no duplication, and the short course ships to new tenants with no work.

| Layer | Today | Needed |
|---|---|---|
| Tenancy | Single tenant | `tenants` table; `tenant_id` on profiles, journal, quiz, engagement; RLS pass on member data |
| Branding | MMFX hard-coded | Per-tenant theme tokens, logo, custom domain (Vercel wildcard), email sender |
| Content | Global, MMFX-branded | Nullable `tenant_id`; global short course + tenant-uploaded rows; brand applied at render (PDF tokens, deck re-template) |
| Authoring | MMFX scripts + admin | Upload-and-publish studio: link-only video URL + thumbnail, PDF and deck upload, class schedule |
| Surfaces | All always visible | Per-tenant feature toggles; a surface hides unless populated |
| Funnel | Single broker routing | Per-tenant broker routing, IB links, trial length, upgrade copy |
| Telegram | One channel | Per-tenant channel binding |
| Email | One SendPulse list | Per-tenant list + sender identity |
| Admin/stats | Global | Tenant-scoped views; MMFX retains a cross-tenant super-admin |
| Moderation | None | Content policy, pre-publish review queue, takedown |
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

**Phase 0 — now.** Deliver the pack. Secure the three preconditions in writing. Scope the
short course (see Q4).

**Phase 1 — build the pilot platform.** Multi-tenancy on member data, branding layer,
per-tenant funnel config and feature toggles, upload-and-publish studio, tenant-scoped
admin and stats, neutral engine brand for the TradingView suite. Produce the short course.
Scope is bounded by §7.

**Phase 2 — pilot, minimum 3 IBs, 60-90 days.** Three branded desks live on shared
infrastructure, each with its own content mix. Success metrics: funded accounts per IB; lots per funded account per month;
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
- **A3.** Narration on the short course stays in Don's voice for the pilot. Per-tenant
  synthesised narration is a Phase 3 option, not a launch requirement.
- **A4.** The neutral engine brand for the TradingView layer is unnamed. Needed before
  Phase 1 ships, not before the pack.
- **Q1.** Does Dupoin expect exclusivity — and would that conflict with the existing
  Octa/Elev8 routing for MY/ID?
- **Q2.** Who is the counterparty on the IB agreement — MMFX and the IB directly, or does
  Dupoin contract the IB?
- **Q3.** Is any per-tenant market or channel exclusivity offered?
- **Q4.** Short course scope — how many lessons, and is it cut down from MM Mentorship or
  written fresh? §3 constrains it to foundational material only.

---

## 12. Out of scope

- **Spec B — multi-tenant platform build.** Tenancy, RLS, branding layer, funnel config,
  attribution pipeline, IB portal. Begins only after §8 condition 1 clears.
- **Spec C — delivery operations.** Ad-account and Business Manager structure, support
  model, per-tenant cost model, moderation workflow.

---

## 13. Success criteria for this spec

The pack is done when a reader at Dupoin can, without asking a follow-up question, state:
what MMFX provides, what the IB must provide, what exists today versus what will be built,
what MMFX is asking for, what Dupoin must supply, and what the first 90 days look like.

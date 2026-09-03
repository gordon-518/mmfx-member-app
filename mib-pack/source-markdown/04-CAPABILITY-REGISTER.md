# 04 · Capability Register

Every claim in this pack falls into one of three columns. The purpose of this document is
that Dupoin can tell them apart without having to ask.

**[LIVE]** — running in production today at `app.marketmakersfx.net`, serving real
members. Demonstrable on request, on a live account, at any time.

**[BUILD]** — designed and scoped, not yet built. Delivered in Phase 1 (see `06`).

**[SPEC]** — specified on paper only. **No delivery date is offered and none should be
assumed.**

---

## Live today

### Platform
- Member application with email/Google authentication and verified signup
- Seven-day full-access trial with automatic expiry
- Access tiers and content gating
- Region-aware upgrade routing by jurisdiction
- Administration: member management, access grants, deposit verification
- Anti-abuse: signup fingerprinting, IP capture, trial-farm detection
- Growth analytics with a daily automated snapshot

### Products
- Ten TradingView indicators and two strategies
- **Automated TradingView grant and revoke** — programmatic, self-healing, no manual
  sharing. This is the piece most competitors cannot replicate
- AI Trading Assistant — read-only MT4/MT5 connection, automatic trade import,
  behavioural leak analysis in dollars, discipline scoring, AI coaching
- Fundamental Desk research bot with PDF delivery
- Know Your Style profiling quiz
- Economic calendar
- Market news and sentiment across nineteen instruments
- Member dashboard

### Marketing and funnel
- Landing page library, one page per product angle
- Creative-ID and campaign tagging convention
- Lifecycle email with automatic status-based segmentation
- Telegram channel automation with CTA rotation and engagement tracking
- Link tracking
- Compliance framework and creative rule set
- AI creative production line — brief to finished asset

### Broker data
- Referred-account export parser with configurable column mapping
- Trading-account registry with balance matching
- Account-to-member matching and review flags

---

## Build required

Delivered in Phase 1, before the pilot goes live.

| Item | Note |
|---|---|
| Multi-tenancy | Tenant scoping across member data, with a full access-control pass. The largest single item |
| Branding layer | Per-tenant theme, logo, custom domain, email sender identity, document templating |
| Per-tenant funnel configuration | Broker routing, referral links, trial length, upgrade copy |
| Per-tenant feature toggles | Surfaces hide unless populated |
| Upload-and-publish studio | The IB's own content: video by link, documents and decks by upload, class schedule |
| Tenant-scoped administration and analytics | Each IB sees their own; MMFX retains a cross-tenant view |
| Content policy and takedown | Review queue and enforcement |
| The short foundation course | Produced neutral-branded and presenter-free |
| Neutral engine brand | For the TradingView suite (see `02`, white-label wall) |

Deferred to Phase 3, after the pilot:

| Item | Note |
|---|---|
| Sub-IB attribution and reporting | **Blocked on Dupoin data** — see `05`, condition 1 |
| IB-facing portal | The IB's own leads, funnel, volume and payout view |
| Server-side conversion events | Improves ad optimisation; not required to launch |
| Short-form / TikTok pipeline | |
| Multi-tenant ad-account structure | Required before Tier 3 scales |

---

## Specified only

**MT5 expert advisor** — an autonomous gold strategy. Fully specified, not built. It is
listed here for completeness because it will come up in conversation. **It is not part of
this proposal and no timeline is attached to it.**

---

## What this means for the pilot

The pilot does not depend on inventing anything. Every product a trader touches — the
indicators, the AI assistant, the research bot, the quiz, the calendar, the news, the
funnel — is live in production today and has been serving MMFX's own members.

Phase 1 is the work of making a working single-brand product serve multiple brands. That
is a substantial engineering effort and it is honestly represented as such in `06`. But it
is a different and much lower risk than building a product from a specification.

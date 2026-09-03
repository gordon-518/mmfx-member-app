# 02 · Product Boundary

The most important document in this pack. It sets out precisely what MMFX supplies, what
the IB must supply, and the three things that cannot be fully white-labelled. It is
written to be over-clear rather than flattering — every ambiguity here becomes a dispute
later.

---

## What MMFX provides

The complete desk, re-branded per tenant. Fifteen items, of which fourteen run without any
ongoing human input.

### Trading tools

**1 · TradingView indicator suite** — ten custom indicators plus two backtestable
strategies, granted automatically to the trader's TradingView account the moment they
submit their username. No codes, no manual sharing, no support ticket. Access is revoked
automatically when a member lapses.

**2 · AI Trading Assistant** — the flagship. Connects **read-only** to the trader's live
MT4/MT5 account, imports every trade automatically with no manual journalling, and shows
them their real performance, the behaviours costing them money quantified in dollars, a
discipline score, and an AI coach that reviews their trading against goals they set
themselves. It cannot trade, cannot withdraw, and the account password is never stored.

**3 · Fundamental Desk** — an interactive research bot that answers what is driving gold
right now and emails a written macro thesis as a PDF.

**4 · Know Your Style** — a short quiz that profiles the trader's archetype and emails the
result. Doubles as a lead magnet at the top of the funnel.

**5 · Economic calendar** — high and medium importance releases, filterable by currency.

**6 · Market news and sentiment** — sentiment-tagged headlines across nineteen instruments.

**7 · Member dashboard** — the trader's home screen: spotlight carousel, live market bar,
embedded calendar and headline feed.

### Funnel and operations

**8 · Signup to funded funnel** — email or Google signup with verification, a seven-day
full-access trial with no card required, then a region-aware upgrade page routing the
trader to the correct broker offer for their jurisdiction.

**9 · Lifecycle email** — transactional and marketing email with automatic list
segmentation by account status, so trial, lapsed and funded members receive different
sequences without anyone maintaining a list by hand.

**10 · Telegram automation** — channel posting, call-to-action rotation, engagement
tracking.

**11 · Anti-abuse** — signup fingerprinting, IP capture and trial-farming detection. This
matters more than it sounds: free trials attract abuse, and abuse inflates every metric
the arrangement is judged on.

**12 · Analytics** — a growth dashboard with a daily automated snapshot across the funnel.

**13 · Member administration** — access grants, deposit verification, member management.

**14 · Link tracking** — short links with a creative-ID convention tying a specific ad to a
specific funded account.

### Content

**15 · A short foundation course** — neutral-branded, presenter-free, shared by every tenant
and re-branded per desk. Deliberately foundational: market mechanics, risk, and platform
orientation. It exists so that a desk is never empty, not to teach a method.

---

## What the IB provides

- **Their audience and their traffic.** MMFX supplies the machine; the IB supplies the
  market.
- **Their brand identity** — name, logo, colours, domain.
- **Their market and language**, and first-line trader support within it.
- **Compliance within their own jurisdiction.**
- **Optionally, their own content.** Course, eBooks, written or video analysis, signals,
  class schedule — uploaded through the platform and published to their desk under their
  brand.

**Nothing on that last line is required to launch.** An IB who uploads nothing ships a desk
with the full tool suite and the short course. That is still a real product — the retention
engine here is the AI Trading Assistant, not the size of a content library.

---

## What is not included

The following remain exclusive to Market Makers FX and are **not** part of the white-label
offer. Named here so there is no expectation to manage later:

- The 19-lesson MM Mentorship course
- The four-title eBook library
- Daily XAU/USD analysis, video and written
- The MMFX signals desk
- Live classes
- Team MM, the private VIP channel

An IB who wants analysis or signals on their desk produces their own and uploads it.

---

## Design constraints that follow

**Feature toggles are mandatory.** Every content surface is hidden by default and appears
only once the IB has populated it. A desk with an empty "Signals" tab reads as broken; a
desk without a Signals tab reads as deliberate.

**The short course is foundational by design.** It teaches market basics and orientation,
not the MM System's entry model. That is a deliberate line: MMFX's method is the one asset
that is genuinely its own, and it does not get distributed into the desks of IBs who may
later compete.

**Content moderation sits with MMFX.** Anything an IB uploads renders on a platform MMFX
operates, on a domain MMFX provisions, to traders funnelled into a Dupoin account under
MMFX's MIB. An IB promising guaranteed returns on their own desk creates exposure for MMFX
and for Dupoin. This requires a content policy in every IB agreement, a takedown
mechanism, and — at pilot scale — review before anything publishes. See `07`.

---

## The white-label wall

Three things do not white-label cleanly. Stated plainly rather than discovered later.

**1 · TradingView scripts carry one author name.** The indicators are invite-only scripts
published from a single TradingView account, and TradingView renders the author's name on
the chart. They cannot be re-branded per IB, and duplicating twelve scripts per tenant is
neither manageable nor within the spirit of TradingView's terms. The resolution: publish
the suite once under a neutral engine brand, so every desk reads "powered by" the same
neutral name rather than a competitor's. Traders see a tool vendor, not another IB.

**2 · Per-tenant infrastructure costs money before it earns any.** Live account connections
are billed per account, plus market data, email and database. Negligible at three tenants,
material at thirty — and incurred from the day a desk goes live, not the day it produces.
This is why a minimum-volume threshold is a condition rather than a preference.

**3 · Support load consolidates onto MMFX.** Every IB's traders eventually reach MMFX for
TradingView grant failures, broker connection errors and access problems. The IB handles
their market; MMFX handles the platform. Scoped explicitly in the IB agreement.

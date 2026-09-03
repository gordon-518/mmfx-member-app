# 03 · Service Catalog

Every entry carries a status marker. Definitions are in `04-CAPABILITY-REGISTER`.

**[LIVE]** — in production today, demonstrable on request
**[BUILD]** — designed, scoped, not yet built
**[SPEC]** — specified only; no delivery date offered

---

## Line 1 — Lead generation

| Service | What it is | Status |
|---|---|---|
| Meta paid advertising | Full-funnel campaign build and management: prospecting, retargeting, geo tiering, restricted-category compliant | **[LIVE]** |
| Creative production line | Concept brief to finished asset — angles, hooks, reference library, finished stills and video, on brand | **[LIVE]** |
| Short-form / TikTok | Vertical hook-first cuts from tool demos and analysis | **[BUILD]** |
| Telegram growth | Channel build, automated posting, CTA rotation, engagement tracking | **[LIVE]** |
| Organic content engine | Long-form analysis repurposed into posts, carousels and PDFs | **[LIVE]** |
| Lead magnets | Trader-profiling quiz, foundation course and eBooks as front-end offers | **[LIVE]** |
| Creative refresh cadence | Fatigue monitoring and scheduled new angles | **[LIVE]** |
| Ad-account structure | Business Manager and account architecture for multi-tenant media buying in a restricted category | **[BUILD]** |

---

## Line 2 — Lead capture and tracking

| Service | What it is | Status |
|---|---|---|
| Landing page library | Feature-specific pages, one per product angle | **[LIVE]** |
| Creative-ID convention | A tagging scheme tying a specific ad to a specific funded account | **[LIVE]** |
| Pixel and server-side events | Browser pixel live; server-side Conversions API to follow | **[BUILD]** |
| Signup to funded funnel | Verified signup, seven-day full-access trial, region-aware upgrade routing | **[LIVE]** |
| Lifecycle email | Automatic list segmentation by account status | **[LIVE]** |
| Link tracker | Short links with tracking | **[LIVE]** |
| Anti-abuse | Signup fingerprinting, IP capture, trial-farm detection | **[LIVE]** |
| Growth dashboard | Funnel metrics with a daily automated snapshot | **[LIVE]** |
| Per-IB attribution | Which trader belongs to which IB, and what they trade | **[BUILD]** — depends on Dupoin data, see `05` |

**On attribution:** MMFX already ingests Dupoin's referred-account export, parses it and
matches trading account numbers to platform members. The parser, the account registry and
the matching logic are live. What is missing is a sub-IB identifier and lots traded in the
data itself. This is an extension of a working pipeline, not a new system.

---

## Line 3 — Products

The fifteen items in `02-PRODUCT-BOUNDARY`, licensed and re-branded into each tenant.

| Service | Status |
|---|---|
| Ten TradingView indicators + two strategies, automated grant and revoke | **[LIVE]** |
| AI Trading Assistant (read-only live account analysis and coaching) | **[LIVE]** |
| Fundamental Desk research bot | **[LIVE]** |
| Know Your Style profiling quiz | **[LIVE]** |
| Economic calendar | **[LIVE]** |
| Market news and sentiment, nineteen instruments | **[LIVE]** |
| Member dashboard | **[LIVE]** |
| Short foundation course | **[BUILD]** |
| Upload-and-publish studio for the IB's own content | **[BUILD]** |
| White-label branding layer (theme, logo, domain, email sender) | **[BUILD]** |
| Per-tenant feature toggles | **[BUILD]** |
| MT5 expert advisor | **[SPEC]** |

---

## Line 4 — IB enablement and retention

The line that justifies an override rather than a fee.

| Service | What it is | Status |
|---|---|---|
| The desk as the retention layer | Every tool above, working to keep the IB's traders funded and active | **[LIVE]** |
| IB onboarding kit | Pitch deck, swipe files, objection handling, compliance rules — so a new IB can start selling in a week | **[BUILD]** |
| Sub-IB portal | The IB's own view: their leads, their funnel, their volume, their payout | **[BUILD]** |
| Trader-survival reporting | Account survival and activity under the MIB, measured against Dupoin's baseline | **[BUILD]** |
| Compliance guardrails | One rule set enforced across every desk, with review and takedown | **[BUILD]** |

The last two are the ones Dupoin should care about most. Survival reporting turns "our IBs
produce more" from an assertion into a measured claim, and the guardrails mean thirty IBs
operating under the MIB do not become thirty independent compliance risks.

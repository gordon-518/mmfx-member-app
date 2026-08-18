# Market Makers FX — Meta Ads Agency Pack

Welcome. This pack contains everything needed to plan, build and launch paid
social for **Market Makers FX (MMFX)**.

**Prepared:** 17 Aug 2026 · **Client contact:** Don (Market Makers FX)

---

## Read in this order

| # | File | What's in it |
|---|---|---|
| **01** | `01-BUSINESS-BRIEF.md` | What MMFX is, how it makes money, who the customer is, the funnel |
| **02** | `02-PRODUCT-FEATURES.md` | Every feature, with the marketing angle for each |
| **03** | `03-LANDING-PAGES-AND-TRACKING.md` | **The LP link table, UTM/creative-ID convention, pixel & CAPI events** |
| **04** | `04-CREATIVE-ASSETS.md` | What's in `assets/`, naming convention, specs, what to produce next |
| **05** | `05-COMPLIANCE.md` | ⚠️ **Read before writing a single ad.** Meta financial-services policy + our hard rules |

**Deep reference (optional):**
- `MMFeatures.md` — the full internal feature reference
- `AI-TRADING-ASSISTANT.md` — deep dive on the flagship product

**Assets:**
- `assets/screens/` — 17 in-app screenshots, ready for creative
- `assets/ads/` — 9 existing ad creatives (image + video covers)

---

## The 60-second version

**Business:** MMFX teaches and equips **gold (XAU/USD) and forex traders**. It's
an **introducing-broker model** — there's no subscription. Members get a free
trial, then keep full access by funding a trading account with a partner broker.
**The money stays in the member's own account, in their own name.**

**Funnel:**
```
Meta ad → landing page (marketmakersfx.net/lp/…) → free signup
   → 7-day full-access trial → fund broker account → member
```

**What we're buying:** trial signups that convert to funded accounts.

**The hero product (new, 14 Aug 2026):** the **AI Trading Assistant** — connects
read-only to a trader's live account and shows them exactly where they're losing
money. Strongest hook we have.

---

## ⚠️ Five things that will bite you if you skip them

1. **Forex is a restricted category on Meta.** Financial-services ad policy
   applies, and some markets require advertiser authorisation. Confirm account
   standing and market eligibility **before** building. See `05-COMPLIANCE.md`.
2. **No earnings claims. Ever.** No profits, no income, no "typical results",
   no profit screenshots. This is both Meta policy and financial-promotion
   regulation. See the safe/unsafe phrasing table in `05-COMPLIANCE.md`.
3. **The `Purchase` event is delayed and manual** — a human verifies the broker
   deposit before it fires. Don't set Purchase as the initial optimisation event.
   Full guidance in `03-LANDING-PAGES-AND-TRACKING.md`.
4. **US/UK have a different offer** (no partner broker; paid lifetime membership
   instead of free-with-deposit). Don't run the standard trial creative there —
   confirm targeting with Don first.
5. **Always use the `/lp/` landing pages, never the app domain.** They're
   purpose-built, message-matched, and carry the attribution the tracking depends
   on. Sending traffic straight to the app breaks measurement.

---

## What we need from you

- Confirmation the ad account is eligible for financial-services advertising in
  the target markets
- Proposed campaign structure + initial creative concepts for approval
- Naming convention alignment (see the `cid` scheme in file 03) so creative
  performance ties back to our analytics

**Anything unclear or missing — ask Don before assuming. Especially any claim
about performance, results, or earnings.**

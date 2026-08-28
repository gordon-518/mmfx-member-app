# Market Makers FX — Master IB Proposal

**Prepared for:** Dupoin Markets · **From:** Don, Market Makers FX
**Date:** 28 August 2026

---

## What this is

Dupoin has proposed a Master IB arrangement: the broker sources IBs, they sit under the
MMFX MIB, MMFX supplies them with the platform, products and marketing to actually
produce, and MMFX earns a per-lot override on the volume they generate.

This pack sets out exactly what MMFX would provide, what it needs from Dupoin, what exists
today versus what would be built, and what the first ninety days look like.

---

## Read in this order

| # | Document | What's in it |
|---|---|---|
| **01** | `01-THE-OFFER` | The positioning, how value is actually created, the three tiers |
| **02** | `02-PRODUCT-BOUNDARY` | **The most important document.** What MMFX provides, what the IB provides, and what does not white-label |
| **03** | `03-SERVICE-CATALOG` | The full service list across lead generation, capture, product and enablement |
| **04** | `04-CAPABILITY-REGISTER` | Live today / build required / not built. Nothing overstated |
| **05** | `05-COMMERCIAL` | The commercial ask and the three conditions this depends on |
| **06** | `06-PHASING` | Build, pilot, scale — with the metrics the pilot is judged on |
| **07** | `07-COMPLIANCE` | The rules every desk operates under, and where liability sits |

Separate: `IB-ONE-PAGER` — the sub-IB-facing summary, for the IBs themselves.

---

## The 60-second version

**The problem with most IB programmes.** A broker signs IBs, hands them a referral link
and a folder of banners, and the majority produce nothing. They have an audience but no
product, so their traders open an account, trade for a few weeks, lose interest or lose
the account, and stop. Volume dies because accounts die.

**What MMFX proposes.** Give every IB under the MIB a complete, white-labelled trading
desk under their own brand: a suite of TradingView indicators granted automatically, an AI
trading assistant that connects read-only to the trader's live account and shows them
where they are leaking money, a macro research bot, a trader-profiling quiz, an economic
calendar, filtered market news, a short foundation course, and a full signup-to-funded
funnel with lifecycle email and analytics behind it. If the IB has their own content, they
upload it and it appears on their desk. If they don't, the tools stand on their own.

**Why this produces volume.** Because it addresses the term of the equation that nobody
else addresses:

```
Volume = funded accounts  x  lots per account per month  x  months the account stays alive
```

Banners buy the first term. MMFX's platform buys the third. A trader who is being coached,
who can see their own behaviour in dollars, and who has a reason to log in every day stays
funded and keeps trading. Dead accounts generate nothing.

**What MMFX asks for.** A per-lot override on downline volume, and three specific things
from Dupoin without which the model does not function. They are in `05-COMMERCIAL` and
they are not negotiable in principle, only in detail.

---

## Five things worth knowing before you read further

1. **This is not vapourware.** The desk described here is live in production today at
   `app.marketmakersfx.net`, serving MMFX's own members. The white-label work is making an
   existing, working product multi-tenant — not building it from scratch. `04` separates
   the two honestly.

2. **MMFX needs sub-IB-level volume data from Dupoin.** Which trader belongs to which IB,
   and how many lots they trade. Without it, MMFX cannot attribute, cannot optimise and
   cannot prove any of this worked. This is the single hard dependency.

3. **The pilot builds the real product, not a demonstration.** Three IBs, three genuinely
   branded desks, sixty to ninety days, measured against Dupoin's own baseline numbers.

4. **MMFX does not fund ad spend.** The override is paid after volume; advertising is paid
   before it. Where MMFX runs paid media for an IB, that spend comes from the IB or is
   co-funded by the broker.

5. **A desk that produces nothing still costs money to run.** Every tenant carries a
   monthly infrastructure cost from day one. Every IB agreement needs a minimum-volume
   threshold and a dormancy clause.

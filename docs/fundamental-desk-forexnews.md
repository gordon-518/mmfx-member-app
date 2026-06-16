# Supercharging the Fundamental Desk with the Forex News API

**Goal:** the MM Fundamental Analysis Desk bot (`api.marketmakersfx.net`) currently
produces a live macro read on gold — a directional **bias** (e.g. *Bearish*), a
**conviction** score, and a short list of **drivers** (real yields, dollar,
breakdowns, etc.). It's good, but it's working from limited inputs.

We now have a **Forex News API** ([forexnewsapi.com](https://forexnewsapi.com)) on
hand, which gives the bot two rich, structured, real-time data streams. This doc
explains **what the API provides** and **exactly how to use it to make the desk's
analysis sharper, more current, and more defensible.**

---

## What the API gives us

One token, two endpoints relevant to fundamentals.

### 1. News + sentiment — `/api/v1`
Real-time financial news, each article pre-tagged. Filterable by **currency pair**
(`XAU-USD` gold, `XAG-USD` silver, all majors + crosses), **sentiment**, **source**,
**type**, and **date**, or the general feed (all pairs + commodities).

```
GET https://forexnewsapi.com/api/v1?currencypair=XAU-USD&items=50&type=article&token=TOKEN
GET https://forexnewsapi.com/api/v1/category?section=general&items=50&token=TOKEN
```
Each item:
```json
{
  "title": "Gold extends recovery above $4,300 with Fed decision, US-Iran deal in focus",
  "text": "…",
  "source_name": "FX Street",
  "date": "Tue, 16 Jun 2026 13:00:00 -0400",
  "topics": ["Gold", "Federal Reserve", "USA"],
  "sentiment": "Positive",          // Positive | Negative | Neutral
  "type": "Article",
  "news_url": "https://…"
}
```
There are **thousands** of gold/USD/commodity items, tagged with topics like
`Gold`, `Federal Reserve`, `USA`, `Oil`, `Silver`, `PCE`, `CFTC` — i.e. exactly the
**drivers** the desk already talks about.

### 2. Economic calendar — `/api/v1/economic-calendar`
Scheduled macro events with consensus and outcomes.

```
GET https://forexnewsapi.com/api/v1/economic-calendar?date=06172026-06242026&importance=High,Medium&currency=USD&token=TOKEN
```
Each event:
```json
{
  "event_name": "Core CPI m/m",
  "country": "United States",
  "currency": "USD",
  "date": "Wed, 17 Jun 2026 08:30:00 -0400",
  "importance": "High",             // High | Medium | Low
  "actual": null,                   // fills in on release
  "forecast": "0.4%",
  "previous": "0.7%"
}
```

> Note: the calendar returns **newest-first** and caps at 50 items/request — query
> a bounded date range (and filter by importance) to get a complete window.

---

## Why this matters for the desk

Today the bot reasons mostly from **price/technical state** plus a fixed model of
drivers. The API adds the two things a real fundamental analyst uses:

1. **What the market is actually saying right now** (news + crowd/AI sentiment).
2. **What's scheduled to move it** (the event calendar, with consensus to measure
   surprises against).

Used together, they let the desk produce a bias that is **evidence-backed,
event-aware, and explainable** — instead of a static read.

---

## Five concrete upgrades

### 1. A live news-sentiment score → feeds bias & conviction
Pull the last N gold + USD articles and aggregate sentiment into a signed score.

```
score = (Σ positive·w − Σ negative·w) / Σ w        # w = recency × source weight
```
- Map `score` to a **sentiment bias** (bullish/bearish/neutral) and blend it with
  the bot's existing technical bias.
- **Agreement raises conviction; disagreement lowers it.** If price says bearish but
  news sentiment is strongly bullish, the desk should *say so* and soften conviction
  — that nuance is exactly what makes a read trustworthy.
- Weight recent articles and trusted desks (Reuters, FXStreet, DailyFX) more heavily.

### 2. Event-risk awareness → pre/post-event behaviour
Pull the upcoming high/medium-impact calendar for **USD + gold-adjacent** currencies.

- **Pre-event:** if a high-impact release (FOMC, CPI, NFP) is within X hours, flag
  it ("⚠ FOMC in 3h") and **cap conviction** — don't hand a confident directional
  call into a coin-flip event.
- **Post-event:** once `actual` posts, compute the **surprise** vs `forecast`:
  ```
  surprise = (actual − forecast)            # normalise per event type
  ```
  A hot CPI / strong NFP is typically **USD-positive → gold-negative**, and vice
  versa. Feed the surprise direction straight into the bias and explain it.

### 3. Driver extraction with receipts
The `topics` array already classifies *why* gold is moving (`Federal Reserve`,
`USA`, `Oil`, real-yields-via-USD stories…). The desk can:
- Surface the **top 2–3 active drivers** by article volume/sentiment.
- **Cite the headline + source** behind each driver, so the read is verifiable
  ("Driver: Fed repricing — *'Gold extends recovery with Fed decision in focus,'*
  FX Street"). Citations turn an opinion into analysis.

### 4. Cross-asset context
Gold doesn't move in isolation. Query `USD-*` pairs and `Oil`/commodity topics to
fold in dollar strength, risk sentiment, and energy/inflation context — the same
inputs the desk lists, now sourced live.

### 5. A "what changed" delta
Cache the previous run's sentiment/driver mix and report **what shifted** since the
last read ("Sentiment flipped positive on the Fed pause; Middle-East risk fading").
That narrative is far more useful to a trader than a static snapshot.

---

## A suggested pipeline

```
        ┌─────────────── every ~15–30 min (cache; respect quota) ───────────────┐
        │                                                                        │
  gold news (XAU-USD)        USD/cross news            economic calendar (next 7d)
        │                          │                            │
        └──────────── aggregate sentiment ───────────┐          │
                                                      ▼          ▼
                                          news-sentiment bias   event-risk + surprises
                                                      │          │
                technical/price bias  ──────►  BLEND & SCORE  ◄──┘
                                                      │
                                                      ▼
                          Desk output:  bias · conviction · top drivers (cited)
                                         · event watch · "what changed"
```

**Conviction model (illustrative):**
```
conviction = base_technical_conviction
           + agreement_bonus(news_sentiment, technical)   # aligned → up
           − event_risk_penalty(imminent_high_impact)     # event soon → down
           ± surprise_adjustment(post-release)            # data confirms/denies
```

---

## Mapping to the bot's current output

| Bot field today | How the API improves it |
|---|---|
| **Directional bias** (Bullish/Bearish) | Blend technical bias with live news-sentiment bias + latest data surprises. |
| **Conviction %** | Raise on news/price agreement; cut ahead of high-impact events; re-rate after releases. |
| **Drivers** (free text) | Replace/augment with API `topics`, ranked by volume + sentiment, each with a cited headline. |
| *(new)* **Event watch** | Next high-impact releases from the calendar, with consensus + countdown. |
| *(new)* **What changed** | Delta vs the previous run's sentiment/driver mix. |

---

## Practical notes

- **Token stays server-side.** The bot calls the API with the token from its own
  env/secret — never expose it client-side. (The member app already does this:
  `FOREXNEWSAPI_TOKEN`, server-only.)
- **Cache & batch.** Aggregate on a schedule (~15–30 min) and cache; don't call
  per page view. The plan's call quota is finite.
- **Commercial tier.** Production/commercial use needs forexnewsapi **Premium
  (~$20/mo)**; the 5-day trial is fine for building and validating coverage.
- **Sentiment is per-article, not gold-specific truth.** Aggregate across many
  articles and weight by recency/source; don't over-trust a single tag.
- **Calendar quirks.** Newest-first + 50-item cap + `MMDDYYYY` date ranges (no
  "this week" keyword) — query a bounded forward window and sort ascending.
- **Compliance.** Keep the desk's read framed as analysis, not a guarantee; the
  standard risk disclaimer still applies.

---

## TL;DR

The Forex News API turns the Fundamental Desk from a static technical read into a
**live, evidence-backed macro analyst**: it knows the current market mood (news
sentiment), it knows what's coming (economic calendar), it can measure data
surprises against consensus, and it can **cite its sources**. Blend those into the
existing bias/conviction model and the desk's analysis gets sharper, more timely,
and far more convincing.

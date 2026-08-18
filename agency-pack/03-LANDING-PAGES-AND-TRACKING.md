# 03 · Landing Pages & Tracking

**This is the operational file. Everything here is already built and live in
production — please use it as specified so attribution works end to end.**

---

## 1. The landing pages

**Eleven** purpose-built landing pages exist for paid traffic. They are
**message-matched** to a single feature/hook and **`noindex`** (paid destinations
only, not organic).

**Base URL pattern:** `https://marketmakersfx.net/lp/{slug}`

| Slug | Headline (the hook the LP delivers on) |
|---|---|
| `ai-trading-assistant` | *You don't have a strategy problem. Nobody's keeping score.* ⭐ |
| `know-your-style` | *Fourteen questions. Then you'll know why your style keeps failing.* ⭐ |
| `daily-analysis` | *Every session, the gold read — before you risk a thing.* |
| `mm-system` | *The exact system. Basic to institutional, in 19 lessons.* |
| `fundamental-desk` | *Know which way gold is leaning before you take the trade.* |
| `analysis-bots` | *Two bots: one reads the macro, one reads you.* |
| `live-classes` | *Twice a week, live on the charts, with the desk.* |
| `ebook-library` | *The whole system, on paper. Four books you'll re-read.* |
| `indicators` | *Drop your TradingView name. Ten indicators appear.* |
| `strategies` | *Backtest the exact entry model — on your own charts.* |
| `signals` ⚠️ | *A few gold calls a day. Entry, stop, target.* — see compliance |

⭐ = our recommended starting points (see §6).

### Supporting pages (organic/reference — usable but not optimised for ads)
- `https://marketmakersfx.net/` — home
- `https://marketmakersfx.net/features` — all features, and `/features/{slug}`
  (11 pages — the organic/SEO equivalents of the LPs above)
- `https://marketmakersfx.net/how-it-works` · `/faq`
- `https://marketmakersfx.net/legal/risk-disclosure` · `/legal/terms` · `/legal/privacy`

> ⚠️ **Never send paid traffic directly to `app.marketmakersfx.net`.** The app is
> the logged-in product. The `/lp/` pages set the attribution cookie that the
> server-side conversion events depend on — bypassing them breaks measurement.

---

## 2. URL structure — use exactly this

```
https://marketmakersfx.net/lp/{slug}
  ?cid={CREATIVE_ID}
  &geo={COUNTRY}
  &offer={OFFER}
  &utm_source=meta
  &utm_medium=paid
  &utm_campaign={CAMPAIGN}
  &utm_content={AD_SET_OR_AD}
```

### The parameters we read

| Param | Purpose | Values |
|---|---|---|
| `cid` | **Creative ID** — ties an individual creative to signups and funded members in our analytics | See §3 |
| `geo` | Country, so the LP and offer routing match | `SG`, `MY`, `ID`, `NG`, `ZA`, `IN`, `AE`, … (ISO-2) |
| `offer` | Which offer the ad promised | `TRIAL` (default) · `LIFETIME` (US/UK only) |
| `utm_*` | Standard analytics | `utm_source=meta`, `utm_medium=paid`, plus campaign/content |

**All of these are captured on the LP, carried into the signup URL, and stored
in a cross-domain cookie for 7 days**, so a signup that happens after the click
still attributes to the right ad.

### Working example
```
https://marketmakersfx.net/lp/ai-trading-assistant?cid=CRT-0917-AITA-SCORE-V1&geo=SG&offer=TRIAL&utm_source=meta&utm_medium=paid&utm_campaign=aita_prospecting_sg&utm_content=score_hook_v1
```

Meta's `fbclid` is appended automatically — **do not strip it.** We use it
server-side to rebuild Meta's click identifier for conversion matching.

---

## 3. Creative ID (`cid`) convention

This is how we attribute revenue to a specific creative. Please follow it.

```
CRT-{MMDD}-{FEATURE}-{HOOK}-{VARIANT}
```

| Part | Meaning | Example |
|---|---|---|
| `CRT` | fixed prefix | `CRT` |
| `MMDD` | creative launch date | `0917` |
| `FEATURE` | which product | `AITA`, `KYS`, `DAILY`, `COURSE`, `FUND`, `CLASSES`, `EBOOK`, `BOTS`, `IND`, `STRAT`, `SIGNALS` |
| `HOOK` | the angle | `SCORE`, `LEAK`, `BLOWUP`, `QUIZ` |
| `VARIANT` | version | `V1`, `V2`, `I1` (image), `B1` (body copy variant) |

**Example:** `CRT-0917-AITA-LEAK-V2`

Keep `cid` **identical** to the creative filename where possible (see
`04-CREATIVE-ASSETS.md`) so a creative can be traced from file → ad → signup →
funded member.

---

## 4. What's already installed

| Layer | Status | Notes |
|---|---|---|
| **Meta Pixel** | ✅ Live on all LPs | `PageView` + events, each with a unique `eventID` |
| **Meta CAPI** (server-side) | ✅ **Live** | Fires from our server; PII is SHA-256 hashed before sending |
| **Event de-duplication** | ✅ | Pixel and CAPI share an `eventID`, so events aren't double-counted |
| **Click-ID matching** | ✅ | `fbclid` captured and converted server-side for match quality |
| **Cross-domain attribution** | ✅ | Parent-domain cookie carries attribution `marketmakersfx.net → app.marketmakersfx.net` |
| **Attribution window** | 7 days | Cookie lifetime |
| **PostHog + Microsoft Clarity** | ✅ Live | Product analytics + session recordings on LPs |

**Pixel ID:** ask Don — supplied separately, not in this pack.
*(The CAPI access token is a server secret and is never shared.)*

---

## 5. Conversion events you can optimise for

| Event | When it fires | Source | Latency |
|---|---|---|---|
| `PageView` | LP loads | Pixel | Instant |
| `CompleteRegistration` | User completes signup | **CAPI** | Instant |
| `StartTrial` | Same moment — the 7-day trial begins | **CAPI** | Instant |
| `Purchase` | **A human verifies the member's broker deposit** | **CAPI** | ⚠️ **Hours to days** |

### ⚠️ Critical: how `Purchase` actually behaves

`Purchase` is **not** an instant e-commerce checkout. The member funds a broker
account, then **an admin manually verifies** it before the event fires. That
means:

- It is **delayed** (hours, sometimes days) and **low-volume by nature**
- It will **never** feed the algorithm fast enough to be the day-one
  optimisation event

**Recommended optimisation path:**
1. **Launch on `CompleteRegistration`** (or `StartTrial` — they fire together).
   Fast, clean, high enough volume to exit learning.
2. **Watch `Purchase` as the business KPI**, not the optimisation target.
3. **Only move to `Purchase`/value optimisation** once weekly volume supports it
   — discuss with Don before switching.

Because the trial is **7 days**, expect roughly a **7–14 day lag** between spend
and the funded conversions it produced. **Please don't judge campaigns on
`Purchase` inside the first fortnight** — the data isn't in yet.

---

## 6. Where we suggest starting

**Two strongest hooks:**

1. **`ai-trading-assistant`** — the newest product and the sharpest emotional
   hook (*"nobody's keeping score"*). It's a genuine differentiator no competitor
   has, and it diagnoses the exact pain the audience feels.
2. **`know-your-style`** — a 14-question profiler. Quizzes are high-intent,
   interactive and self-revealing; historically the strongest top-of-funnel
   asset we have.

**Then:** `daily-analysis` (proof of consistent work) and `mm-system` (the
"where do I start?" beginner angle).

**Geography:** start with the strongest existing base — **Singapore, Malaysia,
Indonesia** — then test Nigeria/South Africa/India. **Do not run the standard
trial offer in US/UK** (different offer entirely — see `01-BUSINESS-BRIEF.md`).

---

## 7. Notes and limitations

- **Every feature has a matching LP** — all 11 are built, live and `noindex`.
- **`signals` is our most compliance-sensitive surface.** The LP itself is
  carefully worded ("teaching examples, not blind calls"). Read
  `05-COMPLIANCE.md` before proposing any signals-led creative, and never
  introduce accuracy, win-rate or profit language in the ad.
- **`strategies` carries a backtest disclaimer** on-page (historical and
  hypothetical, past performance ≠ future results). Ad copy must not undercut
  it by implying returns.
- **Attribution is 7 days.** A signup on day 8 after the click won't attribute.
  Worth knowing when reconciling numbers.

## 8. Reporting we'd like

- Spend, CPM, CTR, CPC by campaign / ad set / **`cid`**
- **Cost per `CompleteRegistration`** — the primary efficiency metric
- Creative-level performance keyed to `cid` so we can match it to funded members
  in our own analytics
- Flag any ad rejections or account warnings **immediately** — in a restricted
  category these compound quickly

# MarketMakersFX — Launch Brief: Business, Features & Creative Assets

*One source of truth for a launch/creative project chat. Covers (1) how the business works, (2) every app feature, (3) where to find the creative assets — app screenshots, in-app imagery, and the Higgsfield product library — to make more creatives.*

App: `app.marketmakersfx.net` · Marketing site: `marketmakersfx.net` · Members sign in with a magic link (no password).

---

## PART 1 — How the business works

### What MMFX is
MarketMakersFX is a **gold (XAU/USD) trading education + signals brand** built on an **Introducing Broker (IB)** model. Members get a complete trading desk — course, indicators, signals, analysis, tools — and MMFX earns by referring traders to partner brokers, **not** by charging a subscription.

### The revenue model (the important part)
Access isn't sold like a course. To keep access after the free trial, a user **funds a $500 trading account at a partner broker through MMFX's IB link**. That **$500 stays the user's own trading capital** — MMFX is paid **rebates by the broker** on the user's trading volume (per lot). This is the core story: *"the desk is free; you just need a funded account to trade with."*

**Broker economics & geo-routing** (why the upgrade page is region-aware):
| Region | Broker | MMFX payout | Member pays |
|---|---|---|---|
| Most of the world | **Dupoin** | ~$20/lot (best) | $0 fee — $500 is their own float |
| Malaysia / Indonesia | **Octa / Elev8** | ~$12/lot | $0 fee — $500 is their own float |
| US / UK | *(no partner broker available)* | — | **One-time lifetime membership** (arranged on Telegram) |

> ⚠️ **Internal only — never put in public creative:** the per-lot payouts, the US/UK lifetime price, and raw IB links/IB number. These are business mechanics. Public creative says only "fund your own account" (ROW) or "one-time lifetime membership" (US/UK).

**IB / funnel mechanics** (internal): MMFX IB # `47807426`. New accounts open via partner links that auto-set the IB; existing traders "switch IB" to MMFX. Verification + access grant is manual via the admin dashboard. Contact/handoff happens on WhatsApp / Telegram (`@MM_3000`).

### The customer journey (the funnel)
```
 Paid ad / social  →  Marketing site (marketmakersfx.net)  →  Sign up (email + name)
        →  14-day FREE full-access trial of the whole desk
        →  Trial ends → /upgrade (geo-routed)
        →  Fund $500 broker account via MMFX  →  Admin verifies  →  Member (full access kept)
```
- **Top of funnel:** paid ads → the marketing site's feature pages.
- **Activation:** magic-link signup → instant 14-day full access (no card, no friction).
- **Conversion:** the value is already experienced during the trial; the upgrade is "keep what you already use" by funding a broker account.
- **Retention/revenue:** ongoing trading volume → IB rebates.

### The brand ecosystem (what to reference in creative)
- **Member app** (`app.marketmakersfx.net`) — the product, all features below.
- **Marketing site** (`marketmakersfx.net`) — public feature pages, live on Vercel.
- **Telegram** — the signals delivery channel + the human contact/IB-switch handoff.
- **Two AI tools** (Fundamental Desk, Know Your Style) — differentiators.
- **TradingView** — where indicators/strategies actually run.

---

## PART 2 — The feature catalog

All features are **Full-access** (free trial or member). Each lists the in-app copy, what the member does, the numbers, a creative hook, and the **screenshot file** to use in creative (see Part 3 for paths).

### 🎓 Education

**MM Mentorship (Course)** — `/course` · *screenshots: `academy.jpg`, `mm-system.jpg`*
- Full curriculum Basic→Advanced, streamed in-app with downloadable slide decks.
- **19 lessons / 6 modules:** Foundations → Reading Price → The Institutional Edge → Building Your Bias → The Entry Model → Managing & Routine.
- *Hook:* "19 lessons. Basic to institutional. The exact system, start to finish."

**The MM Library** — `/library` · *screenshots: `ebook-library.jpg`, `library.jpg`*
- A shelf of trading eBooks, read in-browser or downloaded.
- **4 eBooks**, led by the flagship "The MM System (eBook)."
- *Hook:* "The whole system, on paper. Four books you'll re-read."

### 📈 Tools (auto-granted to your TradingView account)

**Indicators** — `/indicators` · *screenshot: `indicators.jpg`; per-indicator art in `public/indicators/`*
- **10 custom TradingView indicators**, auto-granted to the member's TradingView account after they submit their username — no codes, no manual sharing.
- Suite: Squeeze Pulse, Wave Pressure, Structure Map, Echo Predictor (ML), Trend Rail, Pivot Trend, MTF Minicharts, Auto Trendlines, Adaptive MA, Reversion Bands.
- *Hook:* "Drop your TradingView name. Ten MM indicators appear on your charts."

**Strategies** — `/strategies` · *screenshot: `strategies.jpg`; art in `public/strategies/`*
- Backtestable TradingView strategy scripts, same auto-grant. **2 live + 3 coming.**
- *Hook:* "Backtest the exact entry model — on your own charts."

### 🛰️ The Live Desk

**Daily Analysis** — `/daily-analysis` · *screenshots: `daily-analysis.jpg`, `analysis.jpg`*
- Video read on Gold, session by session — bias + levels + thesis; downloadable PDF per entry.
- *Hook:* "Every session, the Gold read — bias, levels, and the why."

**Signals** — `/signals` · *screenshot: `signals.jpg`*
- Live gold-calls desk via Telegram: **3–5 calls/day, 1:2+ R:R, London & NY, weekly recap.**
- *Hook:* "A few gold calls a day. Entry, stop, target. 1:2 minimum."

**Live Classes** — `/live-classes` · *screenshots: `live-classes.jpg`, `live.jpg`*
- Live-on-the-charts sessions twice a week via Zoom; schedule in-app (UTC).
- *Hook:* "Twice a week, live on the charts, with the desk."

**Economic Calendar** — `/calendar` · *screenshot: `economic-calendar.jpg`*
- High/medium-importance releases, week-by-week, currency-filterable.
- *Hook:* "Know what's about to move Gold — before it does."

**News & Articles** — `/news` · *screenshot: `news.jpg`*
- Sentiment-tagged headlines across **19 instruments**.
- *Hook:* "The macro tape, filtered to what you trade."

### 🤖 AI Tools

**Fundamental Analysis Desk** — `/bots/fundamental` · *screenshots: `analysis-bots.jpg`, `analysis-bots-2.jpg`, `bots.jpg`*
- Interactive bot giving the live macro picture driving XAU/USD; emails a PDF thesis.
- *Hook:* "Ask the desk why Gold is moving. Get the macro answer — and a PDF."

**Know Your Style** — `/bots/know-your-style` · *screenshot: `bots.jpg`*
- Quiz that profiles the member's trader archetype and emails a result.
- *Hook:* "Two minutes. Find out what kind of trader you actually are."

### 🏠 Dashboard — `/dashboard` · *imagery: `public/dashboard/spotlight-*.jpg`*
- The member's home desk: Spotlight carousel, market bar, embedded calendar, headlines teaser.
- *Hook:* "One login. The whole desk, live, the moment you sign in."

### The numbers, at a glance (for headlines)
| Course | Indicators | Strategies | eBooks | Signals/day | Live classes | News filters | AI tools | Trial |
|---|---|---|---|---|---|---|---|---|
| **19** lessons | **10** | **2** live | **4** | **3–5** @1:2+ | **2/wk** | **19** | **2** | **14 days** |

---

## PART 3 — Creative assets: where to find them

### A. App feature screenshots (ready to use)
**17 polished app screenshots** live in the marketing-site repo:
```
~/Documents/Claude/mmfx-marketing-site/public/screens/
```
`academy.jpg · analysis.jpg · analysis-bots.jpg · analysis-bots-2.jpg · bots.jpg · chart.jpg · daily-analysis.jpg · ebook-library.jpg · economic-calendar.jpg · indicators.jpg · library.jpg · live-classes.jpg · live.jpg · mm-system.jpg · news.jpg · signals.jpg · strategies.jpg`
→ These are the per-feature screenshots referenced throughout Part 2.

### B. In-app product imagery (this repo, `public/`)
- `public/indicators/` — cover + icon art for each of the 10 indicators (`<slug>-cover.png`, `<slug>-icon.png`).
- `public/course/` — 19 lesson cover images (`00-…` to `18-…`).
- `public/strategies/` — the 2 strategy visuals.
- `public/dashboard/` — Spotlight stills (course, signals, fundamental, know-your-style) — several already optimized from Higgsfield.

### C. Marketing-site hero / device shots
```
~/Documents/Claude/mmfx-marketing-site/public/
```
`device.png · device-tight.png · hero-phone.png · hero-stand.png/.jpg · panther.jpg · podium.jpg` — phone/device mockups and brand hero shots.

### D. Higgsfield product library (generate more from here)
Gordon's **Higgsfield** workspace is the MMFX product/brand-imagery source, and its **MCP is connected to this session** (workspace plan: Ultra). It already contains:
- Warm **phone-on-desk lifestyle mockups** (iPhone on walnut desk, morning light, MMFX push notifications — light + dark-titanium). *Note: these read as **signals/alerts**, not education — use for the Signals creative.*
- A **TradingView XAU/USD chart** still (CHoCH marked).
- The **Fundamental Desk** app screenshot (live bearish bias + conviction bar).
- The **MM FX logo**.

**To browse it:** `show_medias type=image`. **To make more (pre-approved by Gordon):** `generate_image` with `model:"nano_banana_2"`, `aspect_ratio:"3:2"`, `count:2` (~1–2 min), poll `show_generations type=image`, grab `results.rawUrl`. Don't hotlink CloudFront — download + optimize (`sips -Z 1100 -s format jpeg -s formatOptions 82`) before committing to `public/`.

### E. Capturing fresh app screenshots
The app is live at `app.marketmakersfx.net` (Full-access pages need a member session). For new captures, sign in and screenshot the page directly, or use a throwaway demo member account for the gated views.

---

## PART 4 — Compliance (read before producing ads)
MMFX is a forex/gold **IB business**. Creative must:
- **Never promise returns or guaranteed profit.** Include a risk disclosure.
- Frame the upgrade as **funding your own trading account** ("your capital stays yours") — **except US/UK**, which is an honest **one-time lifetime fee** (don't claim "no fee" there).
- **Never expose** broker payouts, the US/UK price, or raw IB links in public creative.
- Respect geo differences (broker offers vary by country).
- No misleading win-rate claims; "weekly performance recap" is the honest framing.

---

## PART 5 — Suggested launch creative directions
1. **"The whole desk" hero** — one visual, all 9 features as a single login. (Use `device.png` / phone mockups + a screenshot collage.)
2. **Per-feature carousel** — one card per feature using Part 2 hooks + the matching `screens/` screenshot.
3. **The $500 reframe** — "It's not a fee, it's your float." The differentiator vs every subscription competitor.
4. **14-day trial CTA** — "Try the entire desk free for 14 days."
5. **Proof-of-depth** — the numbers table as a single graphic.

*The `paid-ads-creative` skill can generate a full MMFX ad package (briefs + 4 finished images) from any direction above — it already bakes in the compliance + geo-tier logic.*

---

*Reflects the app as built at launch. Counts (19 lessons, 10 indicators, 4 eBooks, 2 strategies, 19 news filters) are pulled from the codebase — update here if the catalog grows.*

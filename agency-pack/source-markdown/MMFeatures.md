# MMFX — Complete Feature Reference for Marketing

> **What this is.** A single, accurate description of every feature inside the
> Market Makers FX member app, written so a marketing/creative process can
> understand what it's selling without guessing.
>
> **Accurate as of:** 14 Aug 2026 · **App:** `app.marketmakersfx.net`
>
> **Rules of use:** Everything here is true of the shipped product. If a claim
> isn't in this file, don't make it — ask. Section 12 lists things you must
> never say, and they are compliance rules, not style preferences.

---

## 1. What Market Makers FX is

MMFX trains and equips **gold (XAU/USD) and forex traders**. The member app is
the home base: the daily market read, the tools to act on it, the education to
get better, and — new — the analytics to see whether any of it is working.

**The founder is "Don"** in all member-facing material. Never "Gordon".

### The business model (important context)
MMFX is an **introducing broker (IB)**. Members don't pay a subscription.
Instead they open/fund a trading account with a partnered broker under MMFX's
IB, and full access switches on.

**The money stays in the member's own account, in their own name.** It is not
a payment to MMFX. This is a genuinely strong selling point — say it plainly.

### Access model
| Stage | What they get |
|---|---|
| **Sign up (free)** | **7-day full-access trial** — everything unlocked |
| **Trial ends** | *Limited* — features stay visible but locked, with a clear path to restore |
| **Funded member** | Full access, permanent while the account stays active |

- One **re-trial** is available if needed.
- Sign-in: **email + password**, with a **6-digit email verification code** at
  signup, or **one-tap Google sign-in**.
- Funded members register their **MT4/MT5 account number** once, so access is
  tied to the account they actually trade.

### Who the member is
- Retail gold/forex traders, heavily **Southeast Asia** (Singapore, Malaysia,
  Indonesia) plus a global tail (Africa, South Asia, Middle East, Europe)
- Mostly self-taught, mixed experience, trading their own capital
- Pain: inconsistency, blown accounts, information overload, no feedback loop

---

## 2. The organising idea

Trading profitably isn't one skill — it's a loop:

> **Analysis → Execution → Trade Management**, on a **foundation** of education.

The app is built around that loop, and the dashboard lays it out visually. Every
feature sits in the stage where a trader needs it. **This framing is very useful
for marketing** — it lets you position any single feature inside a bigger system
rather than as a standalone gimmick.

---

## 3. 🚩 AI Trading Assistant — the flagship

**Members only. Launched 14 Aug 2026. Full detail: `docs/features/AI-TRADING-ASSISTANT.md`.**

Connects to the member's live MT4/MT5 account **read-only** and automatically
reads every trade they've made — then tells them where they're losing money and
why. No manual logging, ever.

- **Performance:** equity curve, net P&L with period-over-period change, win
  rate, profit factor, expectancy, R:R, max drawdown, streaks, hold time,
  exposure; breakdowns by symbol, session and weekday
- **Leaks to beat:** names the behaviour costing money — revenge trading,
  oversized losses, overtrading, worst time slot, sizing up after losses —
  **in dollars**, linked to the exact trades
- **Discipline score:** the member sets their own rules (max daily loss, max
  trades/day, max lot size, instruments, sessions); scored as the share of the
  last 30 trading days with **zero breaches**
- **"Don's read":** an AI coach that reviews their real trades against their own
  goals and gives concrete fixes (on demand, 5/day)
- **Survival engine:** account health, "~N losing trades from your limit",
  weekly mission, and proactive warnings by banner + email

**Trust story (lead with this):** read-only investor password — it can never
trade or withdraw — and the password is never stored.

**Best hook:** *"You don't have a strategy problem. You have a 'nobody's keeping
score' problem."*

---

## 4. Daily Analysis — Don's daily market read

Don's own top-down XAU/USD analysis, published as a regular series (**59
editions published to date**).

Each edition includes:
- A **video walkthrough** of the charts
- A **written report (PDF)** with the levels and reasoning
- The day's **bias** and a **session tag**

**Member value:** they don't start the day guessing. They see how a professional
reads the same chart they're looking at — which is education disguised as a
daily habit.

**Marketing angle:** the consistency is the proof. A daily read, published
day after day, is evidence of real expertise in a market full of screenshot
traders. Great for "day in the life" and habit-forming content.

---

## 5. Signals — the signals desk

The **MMFX Signals Channel** surfaced inside the app.

**Member value:** trade ideas from the desk, in context.

⚠️ **Compliance-sensitive.** Signals must never be framed as guaranteed,
"accurate", or an income source. They are trade *ideas* for the member to
evaluate — never advice, never a promise. Keep claims about signals conservative
and never quote a win rate.

---

## 6. Team MM — the private VIP desk

A **members-only Telegram desk**, invitation-controlled.

How it works: the member taps through to a **direct message with the desk**,
the desk verifies they're a funded member, then sends a **personal, one-off
invite link**. Invites are added by hand — there's no public join link.

**Member value:** proximity. A small room with the desk and other funded
traders, not a 10,000-person free channel.

**Marketing angle:** exclusivity that's *real* rather than claimed — the manual
invite process is itself the proof. Strong retention/aspiration lever.

---

## 7. Indicators — 10 proprietary TradingView tools

Invite-only TradingView indicators, **granted automatically** once the member
enters their TradingView username:

| Indicator | |
|---|---|
| MM Squeeze Pulse | MM Pivot Trend |
| MM Wave Pressure | MM MTF Minicharts |
| MM Structure Map | MM Auto Trendlines |
| MM Echo Predictor | MM Adaptive MA |
| MM Trend Rail | MM Reversion Bands |

**Member value:** MMFX's method, encoded on their own charts. They're not
copying a screenshot — they see the same signals Don does.

**Marketing angle:** *proprietary* and *invite-only* are literal here — these
scripts cannot be obtained anywhere else. Access appears on their TradingView
account automatically, which demos beautifully.

⚠️ Indicators are analysis tools. Never claim they predict price or produce
profits.

---

## 8. Strategies — 2 backtestable systems

Full TradingView **strategy** scripts (not just indicators), so members can
backtest on their own charts:
- **MM AMA SuperTrend** — adaptive-MA SuperTrend: trend direction, flip levels,
  long/short triggers, backtested on gold
- **MM System 5m Entry** — the 5-minute entry model in code: HTF bias, buy/sell
  zones, confirmation

More slots are in build.

**Member value:** they can test the method against history themselves instead of
taking anyone's word for it.

**Marketing angle:** "don't believe us — backtest it" is a confident,
trust-building message. ⚠️ Never publish or imply specific backtest returns.

---

## 9. Course — the MM Mentorship

The structured MM System curriculum: **video modules** plus the **slide deck**
for each module. Video is DRM-protected and watermarked.

**Member value:** the complete method, in order, rather than scattered tips.

**Marketing angle:** this is the "foundation" layer — the answer to *"where do I
even start?"* Pairs naturally with the beginner/overwhelmed avatar.

---

## 10. Know Your Style — trader archetype profiler

An interactive profiler: the member answers **14 questions** and gets their
**trader archetype** and a personalised profile, with the result emailed to them.

**Member value:** self-awareness — which style actually fits their temperament,
time and risk appetite, instead of forcing themselves into someone else's.

**Marketing angle:** ⭐ **the strongest top-of-funnel asset in the app.**
Quizzes convert: they're interactive, self-revealing, and instantly shareable
("I'm a ___ trader"). Ideal for lead-gen and social. It's also the first thing
we point new members at, so it doubles as onboarding.

---

## 11. Everything else

### Fundamental Desk
A live macro read on gold — the current fundamental picture driving XAU/USD.
**Value:** the *why* behind the move, without reading ten news sites.

### Live Classes
Scheduled live teaching sessions inside the app.
⚠️ **Check the current schedule before promoting** — don't advertise a class
that isn't booked.

### Library
Downloadable member resources, including:
- **The MM System (eBook)** — the flagship
- **The Five-Stage Workflow**
- **Decision Trees & Invalidation**
- **Cheat Sheets & Quick Reference**

**Value:** reference material to keep beside the screen while trading.

### News & Articles
Curated forex/macro headlines **with sentiment**, filtered to what matters for
gold and FX. **Value:** market awareness without doomscrolling.

### Economic Calendar
Upcoming high-impact economic events. **Value:** they know what's coming before
it moves the market.

### Dashboard
The member's desk at a glance: live prices, their status, today's brief (gold
bias, next class, latest analysis), the workflow pipeline, and the news feed.

### Start here (roadmap)
A guided first-run path so new members know what to do first instead of
bouncing off a wall of features.

---

## 12. ⚠️ Compliance — non-negotiable

MMFX operates as an introducing broker in a regulated space, with a
Singapore-centred audience. **These rules override any creative idea.**

### Never say or imply
- ❌ Guaranteed, typical, expected or implied **profits, income or returns**
- ❌ "Risk-free", "can't lose", "sure thing", "passive income"
- ❌ That any tool **predicts** the market
- ❌ That signals/indicators are "accurate", or any win-rate claim
- ❌ Specific member results without **written consent**
- ❌ Screenshots of profits presented as typical
- ❌ **Financial advice** or personalised investment recommendations
- ❌ Pressure/urgency framing that pushes someone to deposit money
- ❌ That the broker deposit is a payment to MMFX (it isn't — it's their money,
  in their own account)

### Always true / safe
- ✅ Tools are for **analysis and education**
- ✅ The AI Trading Assistant is **read-only** — it cannot trade or withdraw
- ✅ Outcomes depend on the member's own decisions
- ✅ **Trading carries risk of loss** — include risk disclosure where required
- ✅ Past performance never indicates future results
- ✅ Disclose the IB relationship where required

### Safe vs unsafe phrasing
| ❌ Unsafe | ✅ Safe |
|---|---|
| "Stop losing money" | "See where your money is leaking" |
| "Our signals are 80% accurate" | "Trade ideas from the desk, with the reasoning" |
| "Make consistent profits" | "Build a consistent process" |
| "This indicator predicts reversals" | "This indicator highlights potential reversal zones" |
| "Turn your account around" | "See what your account is actually doing" |

---

## 13. Voice

- **Don**, never Gordon, in member-facing material
- Direct, plain, unhyped. Slightly blunt. No emoji-spam, no guru energy
- Talk about **process and discipline**, not riches
- Respect the reader's intelligence — most have been burned by hype already
- Plain English over jargon in broad-audience material; technical depth is fine
  for the daily analysis audience

---

## 14. Positioning summary

**What MMFX actually sells:** not signals, not indicators — **a complete trading
system with the feedback loop attached.** Analysis to read the market, tools to
act, education to improve, and now an assistant that shows whether it's working.

**The differentiator:** most educators sell you information and disappear. MMFX
gives you the method *and* reads your actual results back to you.

**The access story:** no subscription. Fund your own broker account — your money,
your name — and it all switches on.

---

## 15. Verify before publishing

Always confirm current facts before a campaign:
- Live class schedule
- Member counts or any aggregate results
- Broker terms, deposit amounts, regional offers
- Anything described as "new" or "coming soon"
- Any individual member's results (needs written consent)

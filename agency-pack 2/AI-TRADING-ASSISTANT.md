# AI Trading Assistant — Marketing Reference

> **For marketing/creative use.** This document explains the tool deeply enough
> to write accurate copy about it. Everything stated here is true of the shipped
> product as of **14 Aug 2026**. If you want to claim something not in this file,
> ask first — don't infer.
>
> **Location:** `app.marketmakersfx.net` → *AI Trading Assistant*
> **Access:** Funded members only (not trials)
> **Status:** Live since 14 Aug 2026

---

## 1. The one-sentence version

**It connects to your live trading account, reads every trade you've made, and
tells you exactly where you're losing money and why — automatically, without you
logging a single trade by hand.**

---

## 2. The problem it solves

Most traders don't fail because they can't read a chart. They fail because
**nobody is keeping score.**

The specific, painful realities it addresses:

| The reality | What it costs the trader |
|---|---|
| "I know I should journal, but I don't." | No feedback loop. The same mistake repeats for years. |
| Manual journals get abandoned in ~2 weeks | Effort collapses exactly when the data would start being useful |
| Traders remember their best trades, forget their worst | A distorted self-image; they optimise the wrong thing |
| "I think I'm profitable" | They don't actually know their win rate, expectancy or true drawdown |
| Blow-ups feel sudden | They're not — the pattern (revenge trades, sizing up after losses) was visible for weeks |

The emotional core, and the strongest hook we have:

> **You don't have a strategy problem. You have a "nobody's keeping score" problem.**

---

## 3. Who it's for

- **Primary:** MMFX funded members actively trading a live MT4/MT5 account
- **Best fit:** the trader who's been at it 6+ months, has a system, but can't
  work out why the account isn't growing
- **Also lands with:** the trader recovering from a blow-up who wants to see
  what actually happened
- **Not for:** someone who hasn't started trading yet (there's no data to read)

---

## 4. How it works — the member's experience

**Step 1 — Connect (once, ~60 seconds)**
The member enters their **investor password** (MT5's read-only password) and
their broker server. Not their main password.

**Step 2 — It imports everything**
Trade history pulls in automatically. Nothing to type. It reconstructs complete
round-trip trades from the raw broker records — entries, scale-ins, partial
closes, commission, swap.

**Step 3 — It keeps itself current**
Syncs on its own, roughly daily. The member can also trigger a refresh.

**Step 4 — They open it and see the truth**
Numbers, leaks, discipline score, and the coach's read.

---

## 5. What's actually inside

### 5.1 The performance picture
- **Equity curve** — cumulative P&L, with the drawdown visible
- **Net P&L** for the period, with **▲/▼ change vs the previous period**
- **Win rate · Profit factor · Expectancy · Payoff (R:R)**
- **Max drawdown** in both money and %
- **Streaks** (longest win/loss run + current), **average hold time**,
  **average position size**, **max concurrent exposure**, **best/worst trade**
- **Where you make money** — sorted breakdowns by **symbol**, **session**
  (London / New York / Asian) and **weekday**
- Date filters: 7d · 30d · 90d · YTD · All · custom

### 5.2 "Leaks to beat" — the differentiator
It names the *behaviour* costing money, in dollars, linked to the exact trades:

- **Revenge trading** — trades taken immediately after a loss
- **Oversized losses** — losses far beyond the member's typical loss
- **Overtrading** — days with an abnormal number of trades
- **Worst time slot** — the session/hour that consistently bleeds
- **Sizing up after losses** — increasing risk while tilted *(shown as an estimate)*
- **Skewed R:R** — winners cut short relative to losers *(shown as a what-if)*

It also surfaces **what's working** — the strengths, not just the failures.

### 5.3 The discipline score
The member sets their own rules:
- Max daily loss (fixed amount or % of balance)
- Max trades per day
- Max lot size
- Only trade my instruments
- Only trade my sessions

The score is **the share of the last 30 trading days with zero rule breaches**.
It measures *process*, independent of P&L — a trader can have a green week and a
terrible discipline score, and that's exactly the point.

### 5.4 "Don's read" — the AI coach
An AI review of the member's actual trades, written in Don's voice:
- A **status**: ahead · on track · behind · at risk
- A plain-English **summary** of what's happening
- **What's working** vs **what's leaking**
- Concrete **trade-management fixes**
- Judged against the member's **own stated goals**, not a generic benchmark

Generated **on demand** (up to 5 per day).

### 5.5 Survival engine
- **Account health**: healthy · at risk · critical, based on distance to the
  member's max-drawdown limit
- **Survival runway**: "~N losing trades from your limit"
- **Weekly mission**: one focus for the week, with clean-day progress
- **Interventions**: in-app banner + email when a dangerous pattern appears

### 5.6 Goals
Trading style, monthly target %, max drawdown tolerance, risk per trade,
instruments traded, and a free-text focus ("stop moving my stop loss").
These are what the coach measures against.

---

## 6. Trust & safety — say this clearly, it removes the #1 objection

The biggest hesitation is *"you want my trading account password?"* Answer it head-on:

- ✅ **Read-only.** It uses the MT5 **investor password**, which by design cannot
  place, modify or close trades.
- ✅ **We can never trade your account.**
- ✅ **We can never withdraw.** No withdrawal capability exists.
- ✅ **The password is never stored.** It's passed straight to the broker-data
  provider over an encrypted connection and never written to our database.
- ✅ **Disconnect anytime.** One click. History stays if they want it.

**This is a genuinely strong trust story — lead with it, don't bury it.**

---

## 7. Why it beats the alternatives

| Alternative | Its problem | Our answer |
|---|---|---|
| **Manual journal / spreadsheet** | Abandoned in weeks; only records what you remember | Automatic. Reads every trade whether you'd have logged it or not. |
| **Broker's built-in statement** | Raw numbers, zero interpretation | Tells you *what to change*, not just what happened |
| **Generic journal apps** | Store data, leave analysis to you; usually a monthly fee | Behaviour analysis + an AI coach that knows your goals — included with membership |
| **A mentor reviewing your trades** | Expensive, not continuous | Continuous, and reads 100% of trades, not a sample |

**The sharpest positioning line:**
> Other journals tell you *what* you did. This tells you *what it's costing you*
> — and what to change.

---

## 8. Proof points (safe, factual, quotable)

- Connects in about a minute; **zero manual logging, ever**
- Reads **every** trade — entries, scale-ins, partial closes, commission, swap
- **Read-only** connection; the password is never stored
- Names leaks **in dollars**, linked to the exact trades that caused them
- Discipline scored over the **last 30 trading days**
- AI coach measures against **the member's own goals**
- **Included with membership** — no separate subscription

---

## 9. ⚠️ Compliance — hard rules

MMFX is an introducing broker in a regulated space. These are not stylistic
preferences.

**Never claim or imply:**
- ❌ Any profit, income, or return — guaranteed, typical, or implied
- ❌ That it makes members profitable, or "turns losing traders into winners"
- ❌ That it predicts the market, or that it trades for them
- ❌ Specific performance figures for a named member without written consent
- ❌ That it's financial advice, or personalised investment recommendations
- ❌ Any risk-free / can't-lose framing

**Always be true to:**
- ✅ It's an **analytics and education tool**, not advice
- ✅ It's **read-only** — it cannot execute trades
- ✅ Outcomes depend entirely on the member's own decisions
- ✅ Trading carries risk of loss; include risk disclosure where required
- ✅ Past performance never indicates future results

**Safe framing:** *"See where your money is leaking."*
**Unsafe framing:** *"Stop losing money."* (implies an outcome)

---

## 10. Voice & naming

- Always **"AI Trading Assistant"** — never "the journal" in member-facing copy
- The coach is **"Don's read"**. The founder is **Don** in all member-facing
  material — never "Gordon"
- Tone: direct, no hype, slightly blunt. It's a tool that tells hard truths, so
  the copy should sound like it too
- British/neutral English

---

## 11. Ready-made angles

1. **"Nobody's keeping score."** The core hook — journaling as scorekeeping.
2. **"Your account already knows why you're losing."** The data exists; nobody reads it.
3. **"The blow-up wasn't sudden."** Revenge trades and sizing up were visible for weeks.
4. **"You'll never journal a trade again."** The anti-effort angle.
5. **"What's your win rate? Actually?"** Most traders can't answer. Opens the demo naturally.
6. **"A coach that has read every trade you've made."** Not a sample — all of it.
7. **"Green week, terrible discipline."** Process vs outcome; unusually credible.

---

## 12. Facts to check before publishing

Ask before claiming any of these — they change:
- Number of members using it, or any aggregate member results
- Any specific member's numbers (needs their written consent)
- Roadmap/"coming soon" features
- Pricing changes to membership

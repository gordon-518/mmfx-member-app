# Editorial brief — lifecycle email copy

The input to the Opus 5 editorial pass (v2 plan, task B4) and to the weekly
challenger proposer the brain runs after go-live (task D3). Both produce the
same object, `LifecycleCopy`, and both are gated by the same tests, so both
read this file.

**Status:** the pass has **not been run.** The `defaultCopy` objects on the
branch today are the v1 sentences refitted to the v2 shape, and they are marked
as interim in the PR. Running the pass needs `ANTHROPIC_API_KEY` in the
environment; nothing in this repo may hand-write copy and present it as the
model's output.

---

## 1. The output shape

```ts
interface LifecycleCopy {
  subject: string;      // <= 45 chars
  preheader: string;    // <= 90 chars
  paragraphs: string[]; // 1-3, plain text, no HTML
  ctaLabel: string;     // <= 28 chars, no trailing arrow (the button adds one)
}
```

One object per step. Nothing else: the structure — which module, which link,
which data — is the template's, and copy never reaches for it.

## 2. Who is reading

Production numbers, 2026-09-21, 4,112 profiles:

| Stage | Count | Share | Emailed so far |
|---|---|---|---|
| Free tier (trial expired) | 3,763 | 91.5% | never |
| Trial active (14 days) | 198 | 4.8% | never |
| Member active | 151 | 3.7% | deposit receipts only |

- **825 of 1,000 sampled did zero onboarding steps.** 131 connected
  TradingView, 33 opened the Daily Analysis, 17 did Know Your Style, 4 finished
  lesson 1.
- Time to fund: median 8 days. 48% fund inside the trial, 79% inside 30 days.
- 78 people viewed `/upgrade` and never deposited; 11 clicked through to the
  broker and never deposited.
- 125 of 151 members have been inactive for more than 30 days.
- Every profile is under 90 days old. This is a young list, not a stale one.

**The leak is activation, not pricing.** 91% never touch a feature, so the
trial expires unused, so the ladder is never seen. The first job of an email is
one action inside fourteen days. The second is to tell 3,763 Free-tier users
that Daily Analysis, Know Your Style, the calendar, the news feed, the public
signals channel and Module 1 of the course are already theirs.

## 3. Voice

Sifu: composed, precise, aphoristic. A desk that has seen this before.

- Never shouts, never promises, never pressures. No deadlines, no scarcity, no
  exclamation marks, no emoji, no ALL CAPS in a subject.
- Short declaratives. Concrete nouns. One idea per paragraph.
- Says the awkward thing plainly rather than steering around it — "the deposit
  isn't a fee" beats "unlock premium access".
- Second person, present tense. The reader is an adult with a chart open.
- Signed "— Don, Market Makers FX". Never "MMFX" (internal), never "Gordon".
- Respects the reader's next three minutes. Every email asks for exactly one
  thing, and it is the thing the template's single button does.

## 4. The ladder, and the sentence it rests on

Free (no deposit) → Foundation $50 → Desk $200 → Team MM $500.

Those figures are **deposits into the reader's own trading account** at a
partner broker, opened in their name, which they hold, trade with and can
withdraw. They are not prices, not fees, not subscriptions, and not paid to
Market Makers. Cumulative, and a high-water mark, so a drawdown never removes
access. Copy lock: "deposit into your own account", never "fee".

Free keeps, forever, with no deposit: Daily Analysis every trading day, Know
Your Style, the economic calendar, the news feed, the public signals channel,
and Module 1 of the MM System course.

Market Makers stays free because it is an introducing broker: the broker pays
us when you trade. The reader never pays Market Makers for access.

## 5. One action per step, and the event that proves it

| Step | The single action | Goal event (72h) |
|---|---|---|
| trial/welcome | read today's gold bias | `feature_view daily-analysis` |
| trial/analysis | open today's Daily Analysis | `feature_view daily-analysis` |
| trial/kys | answer Know Your Style | `kys_completed_at` set |
| trial/tv | save the TradingView username | `tv_username_set` |
| trial/lesson1 | open Module 1, Golden Mindset | `onboarding_step_done lesson-1` |
| trial/ladder | read what each rung opens | `upgrade_viewed` |
| trial/day12 | read what changes on day 14 | `upgrade_viewed` |
| nurture/digest | open today's read | `feature_view daily-analysis` |
| nurture/spotlight | read this week's guide | click, then `email_visit` |
| rescue/upgrade-seen | read the tiers again | `upgrade_viewed` (2nd: `deposit_submitted`) |
| rescue/broker-clicked | message Admin Amelia | `deposit_submitted` |
| member/member-d3 | connect the AI Trading Assistant | AITA connected |
| member/member-d7 | open the Fundamental Desk | `feature_view live-class`/`fundamental-desk` |
| member/member-dormant | read today's analysis | any `app_events` row |

Never mention opens, clicks or "tracking" to the reader.

Two steps are special: `nurture/digest` has **no paragraphs** (its body is the
analysis card) and its subject is a token template using `{title}` and
`{bias}`; `nurture/spotlight` keeps the brain's approved body, so its copy
covers the envelope only and the brain's subject wins when there is one.

## 6. Hard bans

Enforced by `src/lib/email/compliance.ts` (verdict must not be `block`) and by
`templates.test.ts`. A hit is rewritten, never waived.

- Outcome language: guaranteed, no-loss, risk-free, double your money, get
  rich, promised/consistent/monthly returns, any `N% return`, any win rate, any
  "make $X a week".
- Business mechanics: the IB number, "IB link", per-lot payouts, "rebate",
  lifetime pricing.
- Pressure: last chance, hurry, don't miss, expires today, act now, only N
  left.
- Needs-a-human (`review`): "targets paid", "delivery", "NN pips", "N winners
  in a row".
- House bans beyond the gate: the words profit, profitable, returns, gains,
  income, earnings, win rate; any digit followed by `%`; emoji; a three-letter
  run of capitals in a subject; "MMFX"; "Gordon".

## 7. What "better" means here

Ranked by what the loop optimises on: **goal rate** first, click rate second,
unsubscribe rate as a ceiling. Open rate is reported and never optimised on —
Apple Mail Privacy Protection pre-fetches the pixel, so the number is inflated
by an unknown amount.

A rewrite is an improvement when it makes the single action more obvious, more
immediate or lower-effort — not when it makes the email more enthusiastic.

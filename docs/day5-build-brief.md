# MMFX Member App — Day 5 Build Brief (Content Gating Foundation + Upgrade Page)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** Build the REUSABLE gating primitive once, apply it to the dashboard (Full users see unlocked cards, Limited users see locked cards), and build the `/upgrade` conversion page with the exact approved copy. This is the foundation every later content page reuses.

Scope is deliberately just these two surfaces. Content pages (`/indicators`, `/strategies`, `/library`, `/course`, the two bots) are Day 6–7 and are OUT of scope today.

---

## Locked decisions (do not redesign)

- **Gating is a reusable primitive, built once.** Do NOT hand-roll access checks per page. Build one server-side tier resolver + one route guard + one locked-card UI pattern, and reuse them everywhere later.
- **Two tiers only:** Full vs Limited, derived from the Day 3 helper (`src/lib/trial/status.ts` → `accessTier`), which already applies the time-check guard. Full = `trial_active`/`re_trial_active` (while `now < trial_ends_at`) and `member_active`. Limited = everything else.
- **Gating is enforced server-side, not just hidden in the UI.** A Limited user who types a gated content URL directly must be redirected to `/upgrade`. (Day 2 deliberately had no gate; this is where gating begins.)
- **`/upgrade` copy is final — implement it verbatim** (below). Do not rewrite, soften, or add profit/return language. Keep the risk footer.
- Reuse the existing theme (the trading-terminal sub-brand). No new font/design system.

## Out of scope today
- All content pages and the bot pages (Day 6–7).
- TradingView username capture (Day 6).
- Real content delivery (Gumlet, R2, signed URLs).
- Geo-based broker routing — use a single placeholder broker link for now.

---

## The tasks — in order. Stop and report after each.

### Task 1 — The gating primitive (build once, reuse forever)
Create `src/lib/access/` with:
1. `getAccess()` — a server-side helper: gets the signed-in user; if none, returns `{ signedIn: false }`. If signed in, calls `supabase.rpc('fn_resolve_trial_status')` (lazy-expire), then returns `{ signedIn: true, profile, tier }` where `tier` comes from `accessTier` in `src/lib/trial/status.ts`.
2. `requireFull(redirectTo = '/upgrade')` — a guard for gated pages: calls `getAccess()`; if not signed in → redirect to `/login`; if tier is not Full → redirect to `/upgrade`. Returns the profile when access is granted. (No content page consumes this yet — it's built today so Day 6–7 pages just call it.)
3. A `<LockedOverlay>` UI component (or a `cardState` helper) for rendering a card in locked vs unlocked state with an "Upgrade to unlock" CTA pointing at `/upgrade`.

Keep these pure/thin and reusable. Stop and report.

### Task 2 — Dashboard rework into the gated member hub
Rework `src/app/dashboard/page.tsx` using `getAccess()`. Two parts: a status-aware header, and the gated card grid.

**2a — Status-aware header (one component, variant by `account_status`).**
Build a `<StatusHeader>` component that swaps content by state. Access stays binary (Full/Limited via the cards); only the header framing changes:

| State | Header content | CTA |
|---|---|---|
| `trial_active` | Countdown: "X days left in your trial" (use existing `daysRemaining`) | Soft "lock in your access anytime" link → `/upgrade`. Light, not a hard sell |
| `re_trial_active` | Countdown + a line noting this is their last trial | Soft, slightly firmer → `/upgrade` |
| `member_active` | "You're a funded member" — calm confirmation / badge | NONE. Never show an upgrade CTA to a member |
| `trial_expired` | "Your trial's ended" | Upgrade push → `/upgrade` |
| `re_trial_expired` | "Your access has ended — deposit to continue" (no re-trial available) | → `/upgrade` |

Do NOT build a `member_status = inactive` variant — activity-gating is not live at launch; that field is dormant. Treat all `member_active` users identically.

Keep the trial countdown soft on purpose: the real persuasion lives on `/upgrade` at expiry (loss-aversion thesis). The trial header informs and nudges lightly; it does not sell hard.

**2b — Gated card grid.**
- Cards for every member surface: **Indicators, Strategies, Library (eBooks), Video Course, Signals, Live Classes, Know Your Style, Fundamental Analysis Desk.**
- **Full tier:** cards unlocked. Targets for not-yet-built pages can point to `#` / a "coming to your member area" state — content pages land Day 6–7. Signals and Live Classes are external links (Telegram / Zoom — placeholders Gordon fills).
- **Limited tier:** every card renders with `<LockedOverlay>` + "Upgrade to unlock" → `/upgrade`.
- Not signed in: existing "Not signed in" message, no redirect.

Reuse the theme. Stop and report.

### Task 3 — `/upgrade` page (verbatim copy)
Create `src/app/upgrade/page.tsx`. Accessible to any signed-in user (this is where Limited users land). Implement this copy EXACTLY, in the existing theme:

> **Headline:** Your 14 days are up. Your desk is still set.
>
> **Subhead:** For two weeks you traded the MM System with everything unlocked. As of today the tools are locked — not gone. Here's what just went quiet:
>
> **What's locked (list):**
> - Your TradingView indicators
> - The backtestable strategies
> - The MM System, Decision Tree, If-Then, and Cheat Sheet
> - The full video curriculum
> - Two live classes a week
> - The daily signals
> - Know Your Style and the Fundamental Analysis desk
>
> **The reframe:**
> Keeping all of it isn't a $500 purchase. It's $500 that stays yours.
> You fund your own trading account with $500 at your broker. That capital sits in *your* account, under *your* name — you trade it, you withdraw it. Nothing is paid to us. Fund your account, and the desk reopens.
>
> **The mechanism (founder voice):**
> I don't charge traders for education, and I never will. When you fund your own account, the broker funds your seat — that's how the desk stays free. Your money goes into your trading, not into a subscription.
>
> **Reassurance:** No subscription. No card on file. No fee. A deposit you own, and a desk that stays open.
>
> **CTA button:** Fund your account — restore full access  → links to `[BROKER_SIGNUP_URL]` placeholder
> **Under the button:** Deposit $500 with [Broker], send your confirmation, and your access is switched back on.
>
> **Footer (compliance — keep verbatim):** Trading involves risk, including the possible loss of capital. No returns are guaranteed.

Use a clearly-marked placeholder constant for the broker URL/name so Gordon swaps it in. Stop and report.

### Task 4 — Review + tests
- If any new pure logic was added (e.g. a `cardState` mapper), add Vitest cases and run the suite.
- Run the `@code-reviewer` subagent against this brief + `/security-review` on the changes. Fix anything BLOCKER/SHOULD-FIX. Then show the diff and stop for approval before committing.

---

## End-to-end verification (the day is done when this passes)
1. As a `trial_active` (Full) user: `/dashboard` shows the countdown header (X days left) and all cards unlocked. `/upgrade` renders correctly with the exact copy and the risk footer.
2. As a `trial_expired` (Limited) user (set `trial_ends_at` to the past, reload): the header reads "Your trial's ended" and `/dashboard` shows every card locked with an "Upgrade to unlock" CTA → clicking lands on `/upgrade`.
2b. As a `member_active` user: header shows the calm "funded member" state with NO upgrade CTA, cards unlocked.
3. Confirm the copy renders verbatim — no invented profit/return language, risk footer present.
4. `.env.local` still not committed.

Commit message: `Day 5: gating primitive, gated dashboard hub, upgrade page`.

---

## Working style
- Full, copy-paste-ready files. Never "edit line X".
- Stop and report after each task. Foundation (Task 1) gets reviewed before the rest builds on it.
- If verification passes, STOP. Content pages are Day 6.

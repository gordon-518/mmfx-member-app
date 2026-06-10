# MMFX Member App — Day 6 Build Brief (TradingView Indicators page + Strategies stub)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** A gated `/indicators` page showing all 10 MM indicators with artwork, a TradingView-username capture so users can request access, that username surfaced in `/admin` for manual granting, and a `/strategies` stub with 5 placeholder cards.

All gating reuses the Day-5 primitive (`requireFull` from `src/lib/access`). Don't re-implement gating.

---

## Locked decisions
- `/indicators` = real, all 10 indicators. `/strategies` = stub, 5 "Coming soon" placeholder cards (scripts not built yet).
- TradingView grant is **manual** for now (admin reads the username and grants on TradingView). Auto-granting via Make is deferred — and unconfirmed feasible (TradingView has no official API). Today only captures the username.
- Use the existing card artwork (PNGs). Reuse the existing theme.
- **SECURITY — IP protection:** Only the `cover-*.png` / `icon-*.png` images may be copied into `public/`. The indicator **`.pine` source files must NEVER be placed in `public/` or anywhere web-served** — they are proprietary IP and `public/` is downloadable by anyone. Do not copy `.pine`, `.md`, or `.txt` from the indicator source into the app.

## Out of scope
- Real strategy scripts (5 coming later — placeholders only today).
- Make / auto-grant automation.
- Editing the indicator Pine source or delivering it through the app.

---

## The tasks — in order. Stop and report after each.

### Task 1 — Migration: capture the TradingView username (foundation, review before applying)
New migration (fresh timestamp):
- Add column `tradingview_username text` (nullable) to `public.profiles`.
- Create `fn_set_tradingview_username(p_username text) returns public.profiles` — `SECURITY DEFINER`, `set search_path = ''`. Updates ONLY the calling user's own row (`auth.uid()`), trimming/validating the username is non-empty. Returns the updated row. `revoke execute from public; grant execute to authenticated;`
  - Reason it's a function, not a direct update: RLS has no user-write policy (Day 3), so a client-side update would be denied. This is the same own-row SECURITY DEFINER pattern as `fn_resolve_trial_status`.
- Output SQL, stop for review. Then Gordon applies via `supabase db push`.

### Task 2 — Stage the artwork (PNGs only)
Copy ONLY the cover and icon PNGs from the indicator source into the app:
- Source: `/Users/gordon/Documents/Claude/MM_Indicators/<NN-slug>/cover-1280x720.png` and `icon-256x256.png`
- Destination: `public/indicators/<slug>-cover.png` and `public/indicators/<slug>-icon.png`
- The 10 slugs: `squeeze-pulse, wave-pressure, structure-map, echo-predictor, trend-rail, pivot-trend, session-vwap, auto-trendlines, adaptive-ma, reversion-bands`.
- **Do NOT copy any `.pine`, `.md`, or `.txt` files.** PNGs only. Confirm the count (20 images) and that no source files were copied.

### Task 3 — `/indicators` page (gated, all 10)
Create `src/app/indicators/page.tsx`:
- Top of file: `const profile = await requireFull();` — Limited users redirect to `/upgrade` automatically.
- Render a header, then a grid of 10 indicator cards. Card data (hardcode this array in the page or a colocated `data.ts`):

  | Name | slug | Type | Signal |
  |---|---|---|---|
  | MM Squeeze Pulse | squeeze-pulse | Momentum | Squeeze release + direction |
  | MM Wave Pressure | wave-pressure | Oscillator | Overbought/oversold zone crosses |
  | MM Structure Map | structure-map | Structure | BOS/CHoCH + OB/FVG zones |
  | MM Echo Predictor | echo-predictor | ML Classifier | Bar-color direction bias |
  | MM Trend Rail | trend-rail | Trend | Trail direction + flip |
  | MM Pivot Trend | pivot-trend | Trend | Early reversal detection |
  | MM Session VWAP | session-vwap | Volume | Session fair value + AMD |
  | MM Auto Trendlines | auto-trendlines | Structure | Break-and-retest patterns |
  | MM Adaptive MA | adaptive-ma | Trend | Slope direction + efficiency ratio |
  | MM Reversion Bands | reversion-bands | Statistical | Outer-band stretch signals |

  Each card: the `<slug>-cover.png` image, name, Type badge, and the signal line.
- **TradingView access block** on the page:
  - If `profile.tradingview_username` is NOT set: a short form (one text input + submit) calling a server action that runs `fn_set_tradingview_username`. Copy: "Enter your TradingView username to get access to all 10 indicators. We grant access manually — you'll be added shortly."
  - If it IS set: show "Access requested for **{username}** — pending. Indicators are granted on TradingView; you'll be added shortly." (Optional: let them update it.)
- **Disclaimer footer (verbatim, from the suite overview):** "MM Indicators are educational decision-support tools. They do not provide investment advice, do not guarantee profitable trades, and do not execute orders. Trading XAU/USD carries substantial risk of loss. Past performance does not indicate future results."
- Reuse the theme. Stop and report.

### Task 4 — `/strategies` stub (gated, 5 placeholders)
Create `src/app/strategies/page.tsx`:
- `const profile = await requireFull();` at the top (same gating).
- Header explaining MM TV Strategies are backtestable TradingView strategy scripts, coming soon.
- A grid of **5 placeholder cards**, each "Coming soon" with a neutral locked/placeholder visual. No data, no capture form.
- Same disclaimer footer. Stop and report.

### Task 5 — Surface the username in /admin
Update the Day-4 `/admin` page: add a `TradingView username` column to the user table so you/support can read it and grant access manually. Read-only display. Stop and report.

### Task 6 — Wire dashboard links, review, commit
- Ensure the Day-5 dashboard's **Indicators** and **Strategies** cards link to `/indicators` and `/strategies`.
- Run `@code-reviewer` against this brief + `/security-review`. Pay special attention: confirm NO `.pine` source landed in `public/`, and `fn_set_tradingview_username` only writes the caller's own row.
- Fix BLOCKER/SHOULD-FIX, show the diff, stop for approval before committing.

---

## End-to-end verification (done when this passes)
1. As a Full user: `/indicators` shows all 10 cards with artwork + the username form. Submit a username → it saves, page now shows "Access requested for {username} — pending."
2. As a Limited user: visiting `/indicators` redirects to `/upgrade` (gating works). Same for `/strategies`.
3. `/strategies` (as Full) shows 5 "Coming soon" placeholders.
4. `/admin` (as admin) shows the TradingView username you just submitted.
5. Confirm `public/` contains only PNGs under `indicators/` — no `.pine` files anywhere web-served.
6. `.env.local` still not committed.

Commit message: `Day 6: indicators page (10), TradingView username capture, strategies stub, admin surface`.

---

## Working style
- Full, copy-paste-ready files and SQL. Stop and report after each task.
- Migration (Task 1) reviewed before applying.
- If verification passes, STOP. Strategy scripts + Day-7 content pages are later.

# MMFX Member App — Day 9 Build Brief (Bot pages)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** Two gated bot pages, each embedding the bot with a reliable "Open in new tab" fallback. Last content surface — small day.

Both bots are confirmed web UIs:
- **Know Your Style** — `https://mmfx-know-your-style-vi3nub4mm-market-makers.vercel.app/`
- **Fundamental Analysis** (MM Analyst · Fundamental Desk) — `https://api.marketmakersfx.net/`

---

## Locked decisions
- Both pages gate with `requireFull()` (reuse the Day-5 primitive).
- **Embed pattern with fallback:** each page shows the bot in a responsive 16:9 (or tall) `<iframe>` AND always shows an "Open in new tab ↗" button linking to the bot URL. Reason: if a bot app blocks framing (CSP `frame-ancestors`), the iframe renders blank — the launcher button keeps the page functional regardless. Don't rely on the iframe alone.
- Reuse the existing theme. No new design system.
- These are Gordon's own apps, so embedding is fine. (The member app's own `X-Frame-Options` from Day 8 governs whether the member app can be framed by others — it does NOT affect the member app embedding these bots.)

## Out of scope
- Auth/SSO into the bots (they handle their own state). Just embed/launch.
- Any change to the bot apps themselves.

---

## The tasks — in order. Stop and report after each.

### Task 1 — Bot pages
Create two gated pages (match the dashboard card routes):
- `src/app/bots/know-your-style/page.tsx`
- `src/app/bots/fundamental/page.tsx`

Each: `requireFull()` at top; a header (title + one-line description); the bot `<iframe>` (lazy, `referrerPolicy="origin"`, allow fullscreen); and an always-visible "Open in new tab ↗" button to the bot URL. If signed-out/Limited, `requireFull` redirects to `/upgrade`.

Descriptions:
- Know Your Style — "Discover your trader archetype — answer a few questions and get a personalized profile."
- Fundamental Analysis (MM Analyst · Fundamental Desk) — "Live macro read on Gold — the current fundamental picture driving XAUUSD."

### Task 2 — Dashboard wiring + framing check
- Wire the dashboard's **Know Your Style** and **Fundamental Analysis** cards to the two routes (remove any `comingSoon`).
- During the build, load each page and check whether the iframe actually renders the bot or is blocked by CSP. Report what you observe for each. (If blocked, the fallback launcher is the intended UX — no code change needed, just tell Gordon so he can set `frame-ancestors` on that bot app if he wants the inline embed.)

### Task 3 — Review + commit
- Run `@code-reviewer` against this brief + `/security-review` (lighter today — confirm `requireFull` gating and that nothing secret is exposed).
- Fix BLOCKER/SHOULD-FIX, show the diff, stop before committing.

---

## End-to-end verification (done when this passes)
1. Full user: both bot pages load; each either shows the embedded bot OR the "Open in new tab" launcher works (note which per bot).
2. Limited user: both pages redirect to `/upgrade`.
3. Dashboard cards link correctly.

Commit message: `Day 9: gated bot pages (Know Your Style, Fundamental Desk) with launch fallback`.

---

## Working style
- Full, copy-paste-ready files. Stop and report after each task.
- Report the framing observation per bot (embeds vs blocked) so Gordon can decide whether to adjust CSP on the bot apps.
- If verification passes, STOP. The member app's content surfaces are now complete.

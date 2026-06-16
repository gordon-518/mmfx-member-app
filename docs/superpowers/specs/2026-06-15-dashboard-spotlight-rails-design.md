# Dashboard redesign — spotlight + workflow rails

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Scope:** The `/dashboard` page only. Feature-page enrichment is a separate
follow-on spec (see "Out of scope").

## Problem

The current dashboard renders all nine member surfaces as one uniform bento
grid ("Your desk"). Gordon's feedback: it's too cluttered, and the grouping
(Desk / Education / Tools clustered together) doesn't tell a story. Reference
point is the Dupoin partner dashboard, where each feature gets its own
descriptive "body". We want the dashboard to feel like a clean launcher that
also sells the core hook: **MMFX gives a trader everything they need to be
profitable** — framed as a workflow: **Analysis → Execution → Trade
Management**.

## Goals

- Declutter: replace the flat 9-tile grid with a clear hierarchy.
- Tell the hook story: the rails follow the profitable-trader workflow.
- Add a dynamic, timely **spotlight** so the dashboard feels alive on each visit.
- Stay 100% on the locked warm-premium design system (see
  `memory/mmfx-design-system.md`) and inside the existing `AppShell`.
- No regression to gating: Limited-tier users still see locked surfaces routed
  to `/upgrade`.

## Out of scope (separate specs)

- **Feature-page enrichment** (sub-project 2): turning each of the nine feature
  pages into a rich, imagery-driven "body". This spec only covers the dashboard.
- Course progress persistence (we do not track per-user lesson progress yet, so
  the dashboard must not promise "resume where you left off").
- Any backend/auth/deploy work.

## Page structure (top to bottom)

The page stays inside `AppShell` (sidebar + mobile bar). Main column,
`max-w-5xl`. Sections in order:

### 1. Status hero (keep)
Unchanged logic. Reuses `headerContent(accountStatus, daysLeft)` — state-aware
eyebrow/title/body/CTA (trial countdown / member confirmation / expiry push).
Same warm card treatment already shipped.

### 2. Spotlight (new)
One large featured block that rotates through up to three slides. Purpose:
surface the single most timely thing without the user hunting for it.

**Slides (in priority order; deduped; only render slides with data):**
1. **Latest Daily Analysis** — newest published `daily_analysis` row. Uses the
   entry's real cover image, bias badge, date. CTA "Watch the read" →
   `/daily-analysis`. (Timely slide → real content imagery.)
2. **Next Live Class** — soonest upcoming `live_classes` row, only if one
   exists in the future. Shows date/title. CTA "Join" → `/live-classes`.
   (Timely slide → real content / class graphic.)
3. **The MM System Course** — evergreen. CTA "Open the course" → `/course`.
   (Evergreen slide → Higgsfield lifestyle imagery.)

**Imagery rule (blend):** timely slides use real content covers; evergreen
slides use curated Higgsfield lifestyle imagery (the warm phone-on-desk
mockups already in the workspace, or newly generated brand shots).

**Rotation behavior:**
- Manual dots to switch slides (always present when >1 slide).
- Gentle auto-advance every ~7s, **paused on hover/focus**, and **fully
  disabled under `prefers-reduced-motion`** (no auto-advance, dots only).
- If only one slide has data, render it statically with no dots.

**Locked tier:** for Limited users the spotlight does NOT show gated content;
it shows a single upgrade-nudge slide (warm peach card, "Your trial's ended /
Restore full access" → `/upgrade`), no rotation.

### 3. Workflow rails (new — the hook)
Three labelled stages rendered as a visual pipeline with `→` connectors
between them (reinforces the Analysis→Execution→Management narrative). Each
stage is a small group of compact cards. Compact card = icon + title +
one-line descriptor, links to the feature page.

- **1 · Analysis** — *Read the market*
  - Daily Analysis — "Session-by-session read on gold" → `/daily-analysis`
  - Fundamental Desk — "Live macro read on XAU/USD" → `/bots/fundamental`
- **2 · Execution** — *Find & place the trade*
  - Signals — "High-conviction calls" → `/signals`
  - Indicators — "10 tools on TradingView" → `/indicators`
  - Strategies — "Backtestable setups" → `/strategies`
- **3 · Trade Management** — *Manage the position*
  - Live Classes — "Twice-weekly, on the charts" → `/live-classes`
  - Know Your Style — "Find your trader archetype" → `/bots/know-your-style`

On desktop the three stages sit side by side with arrows; on narrow viewports
they stack vertically (arrows rotate to point down or are hidden).

### 4. Foundations band (new)
A visually distinct band beneath the pipeline (the skill under all three
stages): "Foundations — the skill under all three".
- The MM System Course — "Basic to advanced, 19 lessons" → `/course`
- eBook Library — "The written system & references" → `/library`

### Locked state (all rails + foundations)
Limited-tier: each compact card dims (opacity + lock icon) and routes to
`/upgrade` instead of the feature, reusing the dashboard's existing locked-card
pattern. The pipeline structure/labels stay visible (shows what they're
unlocking).

## Components & files

- `src/app/dashboard/page.tsx` (server) — extend the data fetch: in addition to
  access/profile, fetch the latest published `daily_analysis` row (id, title,
  cover_path→public URL, bias, published_on, gumlet_id) and the next upcoming
  `live_classes` row (id, title, starts_at). Pass both (nullable) to the client.
- `src/app/dashboard/DashboardClient.tsx` — refactor: keep status hero; replace
  the bento grid with `<Spotlight>` + `<WorkflowRails>` + `<FoundationsBand>`.
- `src/app/dashboard/Spotlight.tsx` (new client component) — slide data array,
  dot controls, auto-advance timer with hover-pause + reduced-motion guard.
- `src/app/dashboard/rails.ts` (new) — the static rail/stage + foundations
  config (stage label, descriptor, feature cards with icon/title/blurb/href).
  Single source of truth so structure is data, not JSX.
- Icons: reuse `src/components/icons.tsx` (add any missing line icons:
  Fundamental Desk already has `DeskIcon`, etc.).

## Data flow

- Spotlight slides are assembled on the **server** (page.tsx) from real rows,
  then passed to the client `Spotlight`. The client only handles rotation UI.
- Rails/foundations are static config — no per-request data.
- Cover image URLs come from the `analysis-covers` public bucket (same pattern
  as `daily-analysis/page.tsx`).

## Imagery / Higgsfield assets

- Evergreen spotlight slide(s) + any brand imagery: use existing warm
  phone-on-desk mockups in the Higgsfield workspace, or generate new ones
  (authorized). Store chosen stills under `public/dashboard/` and reference by
  path (do not hotlink CloudFront in production).
- Asset selection/generation is an implementation-plan step, not a blocker for
  the structural build (placeholders acceptable during build, swapped before
  done).

## Motion

- Entrance: use the CSS `.rise` keyframe (with staggered `animation-delay`),
  **not** framer-motion's mount stagger. Rationale: framer-motion's rAF-driven
  entrance freezes at opacity 0 in backgrounded/headless tabs (observed this
  session); CSS keyframes complete regardless. Spotlight auto-advance is the
  only JS-driven motion and is reduced-motion-gated.
- Hover transitions on cards: 150–300ms, transform-based (no layout shift),
  per the design-system rules.

## Responsive

- Spotlight: image-left/text-right on desktop; image stacks above text on
  mobile.
- Rails: 3 stages side-by-side (lg) → stacked (sm/md). Compact cards reflow to
  full width when stacked.
- Verified breakpoints: 375 / 768 / 1024 / 1440.

## Accessibility

- Spotlight dots are real `<button>`s with `aria-label` ("Show slide N") and an
  `aria-current` on the active dot. Auto-advance respects reduced motion.
- All cards keyboard-focusable with visible focus rings (orange).
- 4.5:1 contrast maintained (warm palette already compliant).

## Verification

- `npx tsc --noEmit` clean, `next build` clean.
- Preview (signed-in demo member): dashboard shows hero + spotlight (rotating)
  + 3-stage pipeline + foundations; screenshot at desktop + mobile widths.
- Flip demo `account_status` to a Limited state: confirm locked cards + upgrade
  spotlight.
- Confirm no console errors; confirm reduced-motion disables auto-advance.

## Open questions

None blocking. Asset specifics (which exact Higgsfield stills / whether to
generate new) resolved during implementation.

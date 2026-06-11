# MMFX Member App — Day 10 Build Brief (Signals + Daily Analysis + Live Classes)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** Finish the three remaining content surfaces. Two are admin-managed dynamic content (Daily Analysis, Live Classes) that Gordon updates himself; one is a simple launcher (Signals).

All pages gate with `requireFull()`. The two new tables reuse the existing `is_full_access()` (read) and `is_admin()` (write) functions — do NOT redefine them.

---

## Locked decisions
- **Daily Analysis & Live Classes are admin-managed** — Gordon adds/removes entries from a form on `/admin`, no code deploy per entry. Tables in the DB; gated pages render them.
- **Signals** is a static gated launcher page → Telegram (no in-app feed, per the no-double-posting decision).
- Writes are admin-only via RLS using `is_admin()`. Reads are Full-only via RLS using `is_full_access()`. No `service_role`.
- Reuse the existing theme + the Day-5 gate.

## Out of scope
- Live-class replays (none recorded yet).
- Pre-loading any daily-analysis or live-class content — the tables start empty; Gordon populates via the admin form.

---

## The tasks — in order. Stop and report after each.

### Task 1 — Migration: two content tables + RLS (review before applying)
New migration:
- `public.daily_analysis`: `id uuid pk default gen_random_uuid()`, `published_on date not null default current_date`, `title text not null`, `gumlet_id text not null`, `description text`, `bias text check (bias in ('bullish','bearish','neutral'))` (nullable), `created_at timestamptz not null default now()`.
- `public.live_classes`: `id uuid pk default gen_random_uuid()`, `starts_at timestamptz not null`, `title text not null`, `zoom_url text not null`, `created_at timestamptz not null default now()`.
- Enable RLS on both. For each:
  - SELECT: `to authenticated using ( public.is_full_access() )`
  - ALL (write): `to authenticated using ( public.is_admin() ) with check ( public.is_admin() )`
- Output SQL, stop for review. Gordon applies via `supabase db push`.

### Task 2 — Admin forms (add + list + delete) on `/admin`
Extend the `/admin` page with two sections (admin-gated already):
- **Daily Analysis:** a form (published_on, title, gumlet_id, description, bias select) that inserts a row; a list of recent entries with a delete action.
- **Live Classes:** a form (starts_at, title, zoom_url) that inserts a row; a list of upcoming entries with a delete action.
- Use server actions; inserts/deletes go through the normal authenticated client (RLS enforces `is_admin()`). Revalidate after each. No edit needed (delete + re-add covers corrections).

### Task 3 — `/daily-analysis` page (gated)
`requireFull()`. List entries newest-first (by `published_on`, then `created_at`). Each: title, date, optional bias badge (bullish=orange / bearish=pearl / neutral=gray, per brand), description, and click-to-play Gumlet player (`https://play.gumlet.io/embed/<gumlet_id>`, single player — don't mount all at once). Empty state: a tidy "No analysis posted yet" message. Reuse theme.

### Task 4 — `/live-classes` page (gated)
`requireFull()`. Show **upcoming** classes (`starts_at >= now()`) first, each with title, date/time, and a **"Join the live class ↗"** button → `zoom_url` (opens new tab; link revealed via the button, not shown as raw text). Optionally list past classes below (no join button). Empty state: "No classes scheduled yet." Reuse theme.

### Task 5 — `/signals` page (gated, static)
`requireFull()`. Brand copy framing the signal service (composed/selective voice: a few high-conviction XAU/USD signals a day, no filler) + an **"Open the signals channel ↗"** button → `https://t.me/+y_Pry2NERes5MDg9`. Reuse theme.

### Task 6 — Dashboard wiring, review, commit
- Wire the dashboard cards: **Signals → `/signals`**, **Live Classes → `/live-classes`**, and ADD a new **Daily Analysis** card → `/daily-analysis` (it wasn't in the original grid).
- Run `@code-reviewer` against this brief + `/security-review`. Confirm: pages `requireFull`-gated, content tables admin-write/full-read via the existing functions, no `service_role`, the Telegram/Zoom/Gumlet values rendered as escaped text.
- Fix BLOCKER/SHOULD-FIX, show the diff, stop before committing.

---

## End-to-end verification (done when this passes)
1. Apply the migration. As admin, add a test daily-analysis entry and a test live-class via the `/admin` forms.
2. Full user: `/daily-analysis` shows the entry and plays the video; `/live-classes` shows the class with a working Join button; `/signals` opens the Telegram channel.
3. Limited user: all three redirect to `/upgrade`.
4. Non-admin authenticated user cannot insert into either table (RLS denies) — the admin forms aren't even reachable for them.
5. Delete the test entries. `.env.local` not committed.

Commit message: `Day 10: signals, daily analysis + live classes (admin-managed), gated`.

---

## Working style
- Full, copy-paste-ready files and SQL. Stop and report after each task.
- Migration (Task 1) reviewed before applying.
- If verification passes, STOP.

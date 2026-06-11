# MMFX Member App — Day 8 Build Brief (Full Course: 19 lessons)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** A gated `/course` page: 19 lessons grouped by level, each with a thumbnail, a gated Gumlet video, a description, and a gated PPT slide-deck download.

All data is in `docs/course-videos.md` (videos, titles, levels, descriptions, thumbnail + PPT filenames). Build from it. PPT delivery reuses the EXACT proven pattern from the Day-7 ebook route.

---

## Locked decisions
- **19 lessons** = Module 0 "Golden Mindset" (intro) + Modules 1–18 (Gordon: cut Module 0 only if you say so; default is include).
- **Thumbnails are PUBLIC card art** (like the indicator covers) → `public/course/`. **Videos** stream from Gumlet (gated by the page + Gumlet domain-restriction). **PPTs are GATED** → private Storage bucket, served exactly like the ebooks.
- **Reuse the Day-7 ebook delivery pattern for PPTs.** Private bucket, `requireFull()`, download via the user's AUTHENTICATED client (RLS double-enforces), stream. **NEVER make the bucket public. NEVER use `getPublicUrl` for gated content.** (This is the public-bucket mistake from Day 7 — do not repeat it.)
- Reuse the existing theme + the Day-5 gate (`requireFull`).

## CRITICAL — IP / size guardrails when staging assets
- Copy ONLY the 19 thumbnail PNGs into `public/course/`. 
- **NEVER copy the `.mp4` files** from `~/Desktop/MM System` anywhere — they are ~17 GB of masters, already on Gumlet, and must never touch the repo or Storage.
- **NEVER put `.pptx` files in `public/`** — they are gated content; they go to the private Storage bucket only.

## Gordon's manual setup (before the live test)
1. Storage → create a **PRIVATE** bucket named `slides`.
2. Upload the 19 PPTs from `~/Desktop/MM System` (their original names are fine — the route maps slug→filename per `docs/course-videos.md`).

---

## The tasks — in order. Stop and report after each.

### Task 1 — Migration: tier-gate the `slides` bucket (review before applying)
New migration: a storage RLS policy on `storage.objects` for `bucket_id = 'slides'`, `for select to authenticated using ( bucket_id = 'slides' and public.is_full_access() )`. Reuse the existing `is_full_access()` — do NOT redefine it. Output SQL, stop. Gordon applies via `supabase db push` (SQL Editor fallback if `storage.objects` ownership complains).

### Task 2 — Gated PPT delivery route
`src/app/api/slides/[slug]/route.ts` — copy the Day-7 `/api/ebooks/[slug]` route's working approach exactly: `requireFull()` first, slug whitelisted, download from the PRIVATE `slides` bucket via the user's authenticated server client, stream `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `private, no-store`, RFC 5987 `filename*`, `nosniff`. Never service_role, never public. Map slug→PPT filename from `docs/course-videos.md`. Stop and report.

### Task 3 — Stage thumbnails (PNGs only)
Copy the 19 correct thumbnails from `~/Desktop/MM System` → `public/course/<slug>.png`, using the filenames mapped in `docs/course-videos.md` (ignore the duplicate/old PNGs). Slugs: `00-golden-mindset, 01-xauusd-explained, 02-what-moves-gold, 03-market-structure-pt1, 04-market-structure-pt2, 05-core-concepts, 06-liquidity-deep-dive, 07-displacement-mastery, 08-daily-bias-pt1, 09-daily-bias-pt2, 10-15m-decision, 11-5m-confirmation, 12-sessions, 13-1m-execution, 14-breaker-blocks, 15-news-macro, 16-trade-management, 17-complete-workflow, 18-daily-sop`. Confirm 19 PNGs copied, and that NO `.mp4` or `.pptx` landed in `public/`. Stop and report.

### Task 4 — `/course` page
`src/app/course/page.tsx`: `requireFull()` at top. Build the lesson data into `src/app/course/courseData.ts` from `docs/course-videos.md` (slug, number, title, level, description, gumletId, thumbnail, pptFilename).
- Render lessons grouped by level: **Basic**, **Intermediate**, **Advanced** (Module 0 leads Basic).
- Each lesson card: thumbnail, level badge, title, description, a "Watch" action, and a "Slides (PPT)" download → `/api/slides/<slug>`.
- "Watch" opens the Gumlet player for that lesson (single player area or modal — do NOT mount 19 iframes at once; load the selected video only). Embed `https://play.gumlet.io/embed/<gumletId>`, 16:9.
- Reuse the theme. Stop and report.

### Task 5 — Dashboard wiring, review, commit
- Dashboard "Video Course" card → `/course` (remove its `comingSoon`).
- Run `@code-reviewer` against this brief + `/security-review`. Confirm: no `.mp4`/`.pptx` in `public/`, the `slides` route gates with `requireFull()` + authenticated client (no service_role, no getPublicUrl), and the page is `requireFull`-gated.
- Fix BLOCKER/SHOULD-FIX, show the diff, stop before committing.

---

## End-to-end verification (done when this passes)
1. Gordon creates the private `slides` bucket + uploads the 19 PPTs; applies the migration.
2. Full user: `/course` shows 19 lessons grouped by level with thumbnails; clicking "Watch" plays the video; "Slides" downloads the real PPT.
3. Limited user: `/course` redirects to `/upgrade`; direct `/api/slides/<slug>` does NOT download. (Proves the slide gate.)
4. Confirm the `slides` bucket is **Private** in the dashboard (a public bucket bypasses the gate entirely — the Day-7 lesson).
5. No `.mp4`/`.pptx` in `public/`; no service_role in code.

Commit message: `Day 8: gated course (19 lessons, Gumlet video + tier-gated PPT slides)`.

---

## Working style
- Full, copy-paste-ready files and SQL. Stop and report after each task.
- Migration (Task 1) reviewed before applying.
- The Limited-user direct-`/api/slides` test + the private-bucket confirmation are the two that prove gating. Don't skip them.
- If verification passes, STOP. Bots are Day 9.

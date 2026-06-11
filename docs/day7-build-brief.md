# MMFX Member App — Day 7 Build Brief (Library + Course)

**For:** Claude Code, in the `mmfx-member-app` Next.js project.
**Goal of the day:** Securely gated `/library` (4 ebooks, served only to Full users) and `/course` (19 Gumlet lessons, gated). Bot pages are Day 8 (open questions). All gating reuses Day-5 `requireFull`.

---

## Locked decisions
- **Ebooks live in a PRIVATE Supabase Storage bucket, never `public/`.** Gated delivery enforced at the STORAGE layer by access tier — not just hidden in the UI.
- **No `service_role` key in the app.** Tier gating on storage is done with a SECURITY DEFINER `is_full_access()` SQL function used in a storage RLS policy. Same posture as every prior day.
- Course videos embed via Gumlet (IDs in `docs/course-videos.md`). Protection is Gumlet-side (domain restriction + watermark), configured by Gordon.
- Bot pages are OUT — Day 8, pending the API-vs-UI and iframe-embedding questions.
- Reuse the existing theme. No new design system.

## Gordon's manual setup (do BEFORE the live test)
1. In Supabase → Storage: create a **private** bucket named `ebooks`. Upload the 4 PDFs with these exact object names:
   - `five-stage-workflow.pdf`
   - `decision-trees-invalidation.pdf`
   - `cheat-sheets-quick-reference.pdf`
   - `mm-system-ebook.pdf`
2. In Gumlet: domain-restrict playback to the member-app domain + enable the dynamic email watermark.

---

## The tasks — in order. Stop and report after each.

### Task 1 — Foundation: tier-gated storage access (review before applying)
New migration:
- `public.is_full_access()` — `SECURITY DEFINER`, `set search_path = ''`, returns boolean for the caller (`auth.uid()`): true if `account_status = 'member_active'`, OR (`account_status in ('trial_active','re_trial_active')` AND `now() < trial_ends_at`). This mirrors the Day-5 time-check guard, in SQL. Grant execute to `authenticated`; `revoke from public, anon`.
- A storage RLS policy on `storage.objects` for `bucket_id = 'ebooks'`: SELECT to `authenticated` `using ( bucket_id = 'ebooks' AND public.is_full_access() )`. (So a Limited user cannot read the objects even by calling storage directly.)
- Output SQL, stop for review. Gordon applies via `supabase db push`.

### Task 2 — Gated ebook delivery + `/library`
- A delivery route `src/app/api/ebooks/[slug]/route.ts` (GET): call `requireFull()` first (redirect Limited → `/upgrade`); then use the user's authenticated server Supabase client to `download` the `<slug>.pdf` from the `ebooks` bucket (storage RLS double-enforces tier); stream it back with `Content-Type: application/pdf` and an inline/attachment disposition. Never expose the bucket publicly; never use service_role.
- `src/app/library/page.tsx`: `requireFull()` at top. Four cards for the ebooks:
  | Title | slug |
  |---|---|
  | The Five-Stage Workflow | five-stage-workflow |
  | Decision Trees & Invalidation | decision-trees-invalidation |
  | Cheat Sheets & Quick Reference | cheat-sheets-quick-reference |
  | The MM System (eBook) | mm-system-ebook |
  Each card has a "Read / Download" action → `/api/ebooks/<slug>`.
- Reuse the theme. Stop and report.

### Task 3 — `/course` (19 gated Gumlet lessons)
- `src/app/course/page.tsx`: `requireFull()` at top.
- Build the lesson list from `docs/course-videos.md` (create `src/app/course/videos.ts` with the 19 IDs in order; titles "Lesson 1"…"Lesson 19" as placeholders Gordon will rename).
- UX: a lesson list (1–19) + a single player area. Clicking a lesson loads THAT Gumlet iframe in the player. Do NOT mount 19 iframes at once (heavy). Embed src pattern: `https://play.gumlet.io/embed/<id>`, 16:9, the attributes from `docs/course-videos.md`.
- Reuse the theme. Stop and report.

### Task 4 — Dashboard wiring, review, commit
- Wire the dashboard's **Library** and **Video Course** cards to `/library` and `/course`.
- Run `@code-reviewer` against this brief + `/security-review`. Specifically confirm: ebooks are NOT in `public/`, the delivery route calls `requireFull()` before serving, no `service_role` key anywhere, and `is_full_access()` matches the Day-5 tier logic.
- Fix BLOCKER/SHOULD-FIX, show the diff, stop before committing.

---

## End-to-end verification (done when this passes)
1. Gordon creates the bucket + uploads the 4 PDFs; applies the migration.
2. As a Full user: `/library` shows 4 cards; clicking one opens/downloads the PDF. `/course` shows 19 lessons; clicking one plays the video.
3. As a Limited user: `/library` and `/course` redirect to `/upgrade`. AND hitting `/api/ebooks/mm-system-ebook` directly redirects/denies — the file does not download. (This is the storage-layer gate proving itself.)
4. Confirm no PDFs in `public/`; no `service_role` in the codebase.
5. `.env.local` not committed.

Commit message: `Day 7: gated ebook library (Supabase Storage + tier RLS), course page (19 lessons)`.

---

## Working style
- Full, copy-paste-ready files and SQL. Stop and report after each task.
- Migration (Task 1) reviewed before applying.
- The Limited-user-direct-URL test in step 3 is the one that proves gating actually works — don't skip it.
- If verification passes, STOP. Bots are Day 8.

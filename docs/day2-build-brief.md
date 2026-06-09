# MMFX Member App — Day 2 Build Brief (Magic-Link Auth)

**For:** Claude Code, in the existing `mmfx-member-app` Next.js project.
**Goal of the day:** A user can request a magic link, click it, get a logged-in session, and land on `/dashboard`. That's it.

---

## Guardrails (do NOT cross — these are later days)

1. **Use Supabase's built-in email for auth. Do NOT wire in Resend.** Resend is for the trial-nurture sequence in Week 3. Touching it today is scope creep.
2. **No auth gate on the dashboard today.** Do NOT redirect unauthenticated users anywhere. Today is only: establish a session and land the user on the dashboard. Gating/redirects are Thursday's work and depend on the trial state machine (Wednesday), which does not exist yet.
3. **No trial logic, no `profiles` writes, no RLS.** Auth only. The schema in `docs/SCHEMA.md` is reference, not today's work.

---

## What already exists (built Day 1 — build ON this, don't recreate)

- `@supabase/ssr` installed.
- `src/lib/supabase/client.ts` — browser client (`createClient`).
- `src/lib/supabase/server.ts` — server client (`createClient`, cookie-based).
- `src/app/dashboard/page.tsx` — stub shell.
- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

There is **no middleware yet** — that's Task 1.

---

## The four tasks — in this exact order. Stop and report after each.

### Task 1 — Session-refresh middleware
Create `src/middleware.ts` using the standard `@supabase/ssr` pattern: refresh the auth session cookie on every request via `createServerClient` + `getUser()`.
- **It refreshes the session only. It must NOT redirect or gate anything.** (No "if no user → redirect to /login". That's Thursday.)
- Add the matcher config that excludes static assets (`_next/static`, `_next/image`, `favicon.ico`, image files).

### Task 2 — Login page
Create `src/app/login/page.tsx` — a client component with one email field and a submit button.
- On submit: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${location.origin}/auth/confirm\` } })` using the browser client.
- Show three states: idle (form), "check your email" (success), and an error message on failure.
- No styling beyond clean and legible. No password field. No social login.

### Task 3 — Auth confirm route handler
Create `src/app/auth/confirm/route.ts` — a `GET` route handler implementing Supabase's server-side token_hash verification:
- Read `token_hash` and `type` from the query string.
- Call `supabase.auth.verifyOtp({ type, token_hash })` with the server client.
- On success: redirect to `/dashboard`. On failure: redirect to `/login?error=auth`.

### Task 4 — Dashboard proves the session + sign out
Update `src/app/dashboard/page.tsx` (server component):
- Read the current user with the server client (`supabase.auth.getUser()`).
- If signed in: display the user's email (e.g. "Signed in as gordon@…").
- If NOT signed in: show a simple "Not signed in" message with a link to `/login`. **Do NOT redirect** — just render the message. (This is how we keep the no-gate guardrail while still being able to test.)
- Add a **Sign out** button (server action or small route) calling `supabase.auth.signOut()`, then redirect back to `/dashboard`. This is needed to test the full loop repeatedly.

---

## Supabase dashboard config — GORDON does this (CC can't)

Before testing, set these in the Supabase dashboard for project `dldrcitoeoxzfctsqlmo`:

1. **Authentication → URL Configuration → Site URL:** `http://localhost:3000`
   - Under **Redirect URLs**, add `http://localhost:3000/**`.
2. **Authentication → Email Templates → Magic Link:** set the link in the template to:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```
   (This is what makes Task 3's route work. The default template points elsewhere.)
3. **Authentication → Providers → Email:** confirm it's enabled (it is by default). Leave "Confirm email" on. Built-in Supabase email is fine for testing — it's rate-limited but works.

---

## End-to-end verification (the day is done when this passes)

1. `npm run dev`, open `http://localhost:3000/login`.
2. Enter your email, submit → see "check your email".
3. Open the email, click the magic link → lands on `/dashboard` showing "Signed in as <your email>".
4. Click **Sign out** → dashboard now shows "Not signed in".
5. Confirm `.env.local` is still excluded from git before committing.

Commit message: `Day 2: magic-link auth — middleware, login, confirm route, dashboard session`.

---

## Working style
- Full, copy-paste-ready files. Never "edit line X".
- Stop and report after each task.
- If you finish Task 4 and it verifies, STOP. Do not start the trial state machine (Wednesday's #1-risk item — it deserves a fresh head).

# Showcase link — no-login demo access for product shots

**Date:** 2026-07-02
**Status:** Approved design — pending plan

## Goal

Give a single **no-login URL** that lands in the app as a demo member, so
external tools (Higgsfield) / people can view every page for product shots —
without exposing real member data, paid files, or the admin panel, and without
a separate deployment.

## Mechanism

**Link:** `https://app.marketmakersfx.net/showcase?token=<SHOWCASE_TOKEN>`

`src/app/showcase/route.ts` (GET):
1. If `token` !== `process.env.SHOWCASE_TOKEN` (or token unset) → redirect `/login` (opaque; no hint the route exists).
2. Else sign in the demo member server-side:
   `supabase.auth.signInWithPassword({ email: SHOWCASE_DEMO_EMAIL, password: SHOWCASE_DEMO_PASSWORD })`
   using the SSR server client (sets the session cookie in the route handler).
3. Redirect to `/dashboard`. On sign-in error → `/login?error=showcase`.

From then, the browser holds the demo member session and browses the whole app
normally — no login prompt.

## Demo account

Seeded via the existing `scripts/demo-user.mjs` (extended): `demo@mmfx.test`,
`member_active` (full access), benign `full_name` ("Alex Rivera"), a `country`
(e.g. `MY`), `user_metadata.roadmap_seen = true` (skips the welcome gate), **not
admin**. Exposes only its own fake profile + shared product content. `/admin`
renders "Not authorized" (is_admin false).

## "Showcase mode" = the demo account (no separate flag)

`src/lib/showcase.ts`:
- `SHOWCASE_DEMO_EMAIL` (from env).
- `isDemoUser(email: string | null | undefined): boolean` — case-insensitive match.

Two behaviors key off it:

1. **Block paid file downloads.** The three gated file routes — `api/ebooks/[slug]`,
   `api/slides/[slug]`, `api/reports/[id]` — return **403** when the caller is the
   demo user (after their existing `requireFull()` gate). Pages/UI still render for
   screenshots; the actual PDF/ebook bytes never leave.
2. **`noindex`.** `src/proxy.ts` adds `X-Robots-Tag: noindex, nofollow` to the
   response when the session user is the demo user. Search engines never index it.

## Security posture

- `SHOWCASE_TOKEN` is an unguessable secret; **rotate it to instantly revoke** the
  link (old links 404 → `/login`).
- Demo is a normal member on read-only-ish surfaces: can't reach `/admin`, can't
  pull paid files, can't see other users' data.
- `/showcase` is exempt from the first-run welcome gate in `proxy.ts`.
- Demo creds live only in env (server-side); never shipped to the client.

## Files

- Create: `src/app/showcase/route.ts`, `src/lib/showcase.ts`.
- Modify: `src/proxy.ts` (noindex for demo + exempt `/showcase`),
  `src/app/api/ebooks/[slug]/route.ts`, `src/app/api/slides/[slug]/route.ts`,
  `src/app/api/reports/[id]/route.ts` (demo 403), `scripts/demo-user.mjs`
  (metadata/profile seed).
- Env (`.env.local` + Vercel, all environments): `SHOWCASE_TOKEN`,
  `SHOWCASE_DEMO_EMAIL` (`demo@mmfx.test`), `SHOWCASE_DEMO_PASSWORD`.

## Testing

- Unit (Vitest): `isDemoUser` (match/case-insensitive/null); a file-route guard
  test — demo user → 403, normal Full user → passes through (mock `requireFull` +
  the demo-check).
- Preview: hit `/showcase?token=…` → lands on `/dashboard` as Alex Rivera; browse
  pages render; a gated file route returns 403; wrong token → `/login`; response
  carries `X-Robots-Tag: noindex`.
- Seed the demo account in prod; set `SHOWCASE_TOKEN` in Vercel; deploy; verify the
  live link.

## Out of scope

- Separate subdomain/deployment (chose token-on-real-app).
- Fabricated/demo content (shows real product content by design — it's marketing
  material already).
- Time-based token expiry (rotation is the revoke mechanism).

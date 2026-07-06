# Showcase link — Plan

> Use superpowers:executing-plans. Steps `- [ ]`.

## Task 1: showcase lib + isDemoUser (TDD)
- Create `src/lib/showcase.ts`: `export const DEMO_EMAIL = process.env.SHOWCASE_DEMO_EMAIL ?? "demo@mmfx.test";` and `export function isDemoUser(email?: string | null): boolean` (case-insensitive === DEMO_EMAIL, false for nullish).
- Create `src/lib/showcase.test.ts`: matches exact, case-insensitive, false for null/other.
- Run test → pass. Commit.

## Task 2: /showcase route
- Create `src/app/showcase/route.ts` (GET): read `token` from URL; if `!process.env.SHOWCASE_TOKEN || token !== process.env.SHOWCASE_TOKEN` → `NextResponse.redirect(origin + "/login")`. Else `const supabase = await createClient(); const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: process.env.SHOWCASE_DEMO_PASSWORD! });` → redirect `/dashboard` (or `/login?error=showcase` on error).
- tsc. Commit.

## Task 3: block paid files for demo
- In `api/ebooks/[slug]/route.ts`, `api/slides/[slug]/route.ts`, `api/reports/[id]/route.ts`: after the existing `const profile = await requireFull()` (or requireFull() call), add `if (isDemoUser(profile.email)) return new Response("Not available in showcase", { status: 403 });`. Where the route calls `requireFull()` without capturing, capture the return. Import `isDemoUser`.
- tsc. Commit.

## Task 4: proxy noindex + exempt /showcase
- In `src/proxy.ts`: add `/showcase` to the welcome-gate exempt regex. After user fetch, if `isDemoUser(user?.email)` set `supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow")` (and set the same on any redirect response). Import `isDemoUser`.
- tsc + build. Commit.

## Task 5: seed demo account
- Extend `scripts/demo-user.mjs`: after creating the user, set `raw_user_meta_data` to include `full_name: "Alex Rivera"`, `roadmap_seen: true`; set `profiles.full_name='Alex Rivera'`, `country='MY'`, `is_admin=false`. (Keep member_active.)
- Run against prod (pooler). Verify row. Commit.

## Task 6: env + verify + deploy
- Add to `.env.local` + Vercel (all envs): `SHOWCASE_TOKEN` (random 32+ char), `SHOWCASE_DEMO_EMAIL=demo@mmfx.test`, `SHOWCASE_DEMO_PASSWORD` (matches seed).
- `npm test` + `npm run build`.
- Preview: `/showcase?token=…` → `/dashboard` as Alex Rivera; a gated file route → 403; wrong token → `/login`; check `X-Robots-Tag` on a response.
- Merge → main, push, `vercel --prod`, smoke-test live link. Update memory. Give Gordon the URL.

## Self-review
- Covers: link (T2), demo identity (T1), file block (T3), noindex+exempt (T4), account (T5), env/deploy (T6). ✅ isDemoUser/DEMO_EMAIL consistent.

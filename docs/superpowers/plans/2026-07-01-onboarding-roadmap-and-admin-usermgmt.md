# Signup country · Roadmap welcome · Admin user mgmt — Plan

> Use superpowers:executing-plans. Steps use `- [ ]`.

**Conventions:** SECURITY DEFINER fns pin `search_path=''`; writes via definer fns / service-role server-only; Vitest (Node) with `vi.mock`; Management API SQL via curl/node fetch (not python urllib — Cloudflare 1010). Follow existing warm-premium tokens.

---

## Task 1: Migration — country column, trigger, admin lookup fn

**Create:** `supabase/migrations/20260701_country_and_admin_usermgmt.sql`

```sql
alter table public.profiles add column if not exists country text;

-- extend handle_new_user to also copy country from metadata (keep full_name + trial seed)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, country, signup_at, trial_ends_at, trial_count, account_status, member_status)
  values (
    new.id, new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'country')), ''),
    now(), now() + interval '14 days', 1, 'trial_active', 'inactive'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- admin-only exact-email lookup for the user-management panel
create or replace function public.fn_admin_find_user(p_email text)
returns table (id uuid, email text, account_status text, banned boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select u.id, u.email::text, p.account_status,
           (u.banned_until is not null and u.banned_until > now()) as banned
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email)) and u.deleted_at is null;
end; $$;

revoke all on function public.fn_admin_find_user(text) from public, anon;
grant execute on function public.fn_admin_find_user(text) to authenticated;
```

- [ ] Write file. Apply via curl (`python3 -c` builds the JSON body from the file; `curl -d @-`). Verify: `country` column exists, `fn_admin_find_user` present, `handle_new_user` still present.
- [ ] Commit.

## Task 2: countries.ts (TDD)

**Create:** `src/lib/countries.ts` + `src/lib/countries.test.ts`

- [ ] Test: `COUNTRIES.length > 150`; all `code` length 2 & unique; includes `MY`,`ID`,`US`,`GB`.
- [ ] Implement: `export const COUNTRIES: { code: string; name: string }[] = [...]` (ISO-3166 list). `export function countryName(code): string`.
- [ ] Run test → pass. Commit.

## Task 3: Country on signup

**Modify:** `src/app/signup/page.tsx`, `src/components/auth/SignupForm.tsx`

- [ ] `page.tsx` (server): `const geo = ((await headers()).get("x-vercel-ip-country") ?? "").toUpperCase();` pass `defaultCountry={geo}` to `SignupForm`.
- [ ] `SignupForm`: add `defaultCountry?: string` prop; `const [country, setCountry] = useState(defaultCountry && COUNTRIES.some(c=>c.code===defaultCountry) ? defaultCountry : "")`. Add a required `<select>` (styled like the fields; label "Country") above or below email, options from `COUNTRIES`. Include `country` in `signUp` `options.data`. Block submit if `!country`.
- [ ] tsc + lint clean. Preview: dropdown renders, geo pre-selected. Commit.

## Task 4: Google-signup country capture

**Modify:** `src/app/auth/confirm/route.ts`; **Modify:** `src/lib/signupIp.ts` (add `recordSignupCountry`)

- [ ] In `signupIp.ts` add `recordSignupCountry(userId, country)` — service-role, set-once (`.is("country", null)`), upper-cased, best-effort (mirror `recordSignupIp`).
- [ ] In `/auth/confirm` `?code=` branch (after `exchangeCodeForSession`), read `request.headers.get("x-vercel-ip-country")` and call `recordSignupCountry(data.user?.id, ...)`. Best-effort.
- [ ] tsc clean. Commit.

## Task 5: Roadmap welcome page

**Create:** `src/app/welcome/page.tsx`, `src/app/welcome/RoadmapJourney.tsx`, `src/app/welcome/EnterDeskButton.tsx`

- [ ] `RoadmapJourney.tsx` (server component): renders the 3-level climb from `STAGES` (import from `@/app/dashboard/rails`) — numbered levels with connectors, per-level feature cards (icon+title+blurb, `Link` to `card.href`), summit banner "A profitable, independent trader", foundations line (`FOUNDATIONS`). Warm-premium tokens; matches the approved mockup.
- [ ] `EnterDeskButton.tsx` (`"use client"`): button "Enter your desk →"; onClick `await createClient().auth.updateUser({ data: { roadmap_seen: true } })` then `window.location.assign("/dashboard")`.
- [ ] `page.tsx` (server): `getAccess()`; if `!signedIn` redirect `/login`. Render `<AppShell …><RoadmapJourney/><EnterDeskButton/></AppShell>`. Metadata title "Your roadmap".
- [ ] tsc + lint. Commit.

## Task 6: First-run gate in proxy + "Start here" nav

**Modify:** `src/proxy.ts`, `src/components/AppShell.tsx`

- [ ] `proxy.ts`: replace the bare `await supabase.auth.getUser()` with `const { data: { user } } = await supabase.auth.getUser();` then:

```ts
const ROADMAP_SINCE = Date.parse("2026-07-01T00:00:00Z");
const path = request.nextUrl.pathname;
const exempt = /^\/(welcome|login|signup|forgot-password|auth|api|privacy|terms)(\/|$)/.test(path);
if (
  user && !exempt &&
  !user.user_metadata?.roadmap_seen &&
  user.created_at && Date.parse(user.created_at) > ROADMAP_SINCE
) {
  const url = request.nextUrl.clone();
  url.pathname = "/welcome";
  return NextResponse.redirect(url);
}
```
(Keep cookie handling; redirect must carry `supabaseResponse` cookies — build the redirect from a response that copies them, or set cookies on the redirect. Simplest: `const res = NextResponse.redirect(url); supabaseResponse.cookies.getAll().forEach(c=>res.cookies.set(c));  return res;`)

- [ ] `AppShell.tsx`: add `{ label: "Start here", href: "/welcome", icon: CompassIcon }` as the FIRST `NAV` entry (add a `CompassIcon` to `icons.tsx` if none; else reuse `StyleIcon`).
- [ ] tsc + lint + `npm run build`. Commit.

## Task 7: Admin ban/delete (TDD)

**Create:** `src/lib/adminUsers.ts` (service-role helper), `src/app/admin/UserAdmin.tsx`
**Modify:** `src/app/admin/actions.ts`, `src/app/admin/page.tsx`, `src/app/admin/actions.test.ts` (create if absent)

- [ ] `adminUsers.ts` (`server-only`): lazy service-role client + `banUserById(id, ban)`, `deleteUserById(id)` wrappers over GoTrue admin.
- [ ] `actions.ts`: `lookupUserAction(formData)`, `banUserAction(formData)`, `deleteUserAction(formData)` — each `requireAdmin`; resolve via `supabase.rpc("fn_admin_find_user",{p_email})`; enforce exactly-one; delete refuses `account_status==="member_active"` and requires `confirmEmail===email`. Return typed results.
- [ ] Tests (mock `@/lib/adminUsers`, `@/lib/supabase/server` with rpc + is_admin, `@/lib/access`): exactly-one enforcement; member_active delete refusal; email-mismatch refusal; happy ban + delete call the right helper.
- [ ] `UserAdmin.tsx` (`"use client"`): email input + Look up (server action) → shows result → Ban/Unban + Delete (type-email confirm). 
- [ ] Add `<UserAdmin/>` in a new "User management" `<section>` on `/admin` (near the sync section).
- [ ] tsc + lint + tests green. Commit.

## Task 8: Verify + deploy

- [ ] `npm test` all green; `npm run build` ok.
- [ ] Preview (throwaway Full user): signup country dropdown pre-selected from geo → profile.country set; new user redirected to `/welcome`; "Enter your desk" → dashboard, no re-redirect; "Start here" nav opens roadmap; `/admin` lookup → ban → unban → delete a throwaway user. Clean up any test user with `scripts/admin-delete-user.mjs --confirm`.
- [ ] Merge → main, push, `vercel --prod`, smoke-test. Update memory.

---

## Self-Review
- Spec coverage: A1 (T1 col+trigger, T3 signup, T4 google), A2 (T5 page, T6 gate+nav), B (T1 fn, T7 actions+UI). ✅
- Placeholders: none. Types: `fn_admin_find_user`, `country`, `roadmap_seen`, `COUNTRIES` consistent across tasks.
- Note: definer/service-role writes match repo; UI preview-verified, logic TDD'd.

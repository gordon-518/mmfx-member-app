# Auth rebuild: email + password, email-code verification, Google login

**Date:** 2026-06-29
**Status:** Approved design — pending implementation plan
**Supabase project:** `dldrcitoeoxzfctsqlmo`

## Problem

Magic-link auth has caused recurring, hard-to-support failures. The root cause:
an emailed link opens in a **different browser context** than the one that
requested it — Telegram's in-app webview, iCloud Private Relay, or
"request on laptop, click on phone." Any flow that depends on **clicking an
emailed link** reintroduces this bug.

We want a scalable, predictable login that does not depend on clicking email
links.

## Core principle: codes, not links

Every email-based step uses a **6-digit code the user types into the same tab**
they are already in. No cross-context handoff. The only unavoidable redirect is
Google OAuth, and Google manages its own session, so it sidesteps the problem.

This yields three entry paths, none dependent on clicking an email link:

1. **Google** — one click, no password, no email step.
2. **Email + password** — returning users.
3. **Email + password + 6-digit code** — new signups verify their email once.

## Decisions (locked)

- **"2FA on signup" = verify email at signup only.** A 6-digit code confirms the
  user owns the email at signup. After that, logins are email+password (or
  Google). No per-login second factor — minimal funnel friction.
- **Existing passwordless users migrate via Forgot Password.** The 109 migrated
  Softr members and all trial signups so far have no password. The
  forgot-password flow sets their first password. No one is locked out.
- **Magic link is removed from the UI.** Replaced by "Forgot password?".
- **Google login is included.**
- **Proactive migration email** to current passwordless users is included as a
  safety net (drafted and shown for approval before sending).

## Auth flows

### Sign up — `/signup`
1. Name + email + password → `supabase.auth.signUp({ email, password, options: { data: { full_name, fingerprint } } })`.
2. Supabase emails a **6-digit code** (template emits `{{ .Token }}`). No session yet.
3. UI swaps to an "enter the code" screen in the **same tab**.
4. `verifyOtp({ email, token, type: 'signup' })` → session → `/dashboard`.
5. Trial starts on verification — existing `handle_new_user` trigger seeds the
   profile (`trial_active`, 14-day clock, `full_name` from metadata).

### Log in — `/login`
- Email + password → `signInWithPassword({ email, password })` → `/dashboard`.
- Unverified account → "Please verify your email" + a resend action.
- Known email with no password set (legacy user) → error nudges to
  "Set your password" (→ `/forgot-password`), enumeration-safe.

### Forgot / set password — `/forgot-password`
Also the migration path for existing passwordless users.
1. Enter email → `resetPasswordForEmail` (template emits a **code**, not a link).
2. Enter 6-digit code → `verifyOtp({ email, token, type: 'recovery' })` → short-lived session.
3. Set new password inline → `updateUser({ password })` → `/dashboard`.

### Google — button on `/login` and `/signup`
- `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/confirm } })`
  → Google → `/auth/confirm?code=...` → `exchangeCodeForSession(code)` → `/dashboard`.
- The existing `?code=` branch in `/auth/confirm` already handles this.
- Google supplies `full_name` in `raw_user_meta_data`, so the trigger seeds the
  profile + trial automatically. No fingerprint for OAuth signups (acceptable —
  it is a soft abuse signal only).
- Google email matching an existing user → Supabase links by email; the existing
  profile/trial is reused and the user lands on their dashboard.

## Component architecture

`AuthScreen.tsx` is overloaded and login/signup now diverge significantly.
Refactor into focused, independently testable units:

```
src/components/auth/
  AuthShell.tsx          ← brand panel + layout + logo (extracted, visually unchanged)
  GoogleButton.tsx       ← "Continue with Google" + divider
  LoginForm.tsx          ← email + password; links to forgot/signup
  SignupForm.tsx         ← name+email+password → code-verify sub-state
  ForgotPasswordForm.tsx ← email → code → new password (3 sub-states)
  OtpCodeInput.tsx       ← shared 6-digit input (signup + forgot)
```

- Pages stay thin: `/login`, `/signup`, new `/forgot-password` each render the
  shell + their form.
- `/auth/confirm` keeps only the `?code=` (Google/OAuth) branch + a generic
  fallback redirect; magic-link copy removed.
- `AuthScreen.tsx` is deleted.
- **Design system:** `AuthShell` preserves the existing warm-premium visuals
  exactly (brand panel, gradients, `rise` animations). This is a code
  reorganization, not a visual redesign.

## Supabase configuration (outside app code)

Performed via Management API (`SUPABASE_ACCESS_TOKEN`) + Google Cloud console.

1. **Email templates** — "Confirm signup" and "Reset password" rewritten to show
   `{{ .Token }}` (the 6-digit code) instead of `{{ .ConfirmationURL }}`. This is
   the load-bearing change. **Template-only PATCH** — must not touch the SMTP
   block (changing the SMTP password resets the email rate limit to 2/hr).
2. **Google provider** — enabled with a Google Cloud OAuth Web client.
   Authorized redirect URI: `https://dldrcitoeoxzfctsqlmo.supabase.co/auth/v1/callback`.
   Requires Client ID + Secret from Gordon's Google Cloud account (the only
   external dependency / blocker, and only for the Google button).
3. **Password policy** — min length 8; client-side validation mirrors it.
4. **Redirect allow-list** — confirm `app.marketmakersfx.net` is allowed (it is).

## Migration of existing passwordless users

- The forgot-password flow is the self-serve path; no user is ever locked out.
- **One-time proactive email** to all current passwordless members: short
  "we upgraded login — set your password" message linking to `/forgot-password`.
  Sent via SendPulse API. Drafted and approved before sending. Respects the
  SendPulse rate limit (5,000/hr, 50k/mo plan).

## Error handling & edge cases

- Wrong/expired code → inline error + "Resend code" (respects 1000/hr Supabase
  email rate limit).
- Disposable-email block (anti-abuse Layer 1) stays, now at password-signup.
- Email already exists on signup → enumeration-safe "you already have an account
  — sign in" path (Supabase returns an obfuscated success for existing emails).
- Sessions: password sessions use the same cookie mechanism as magic-link
  (`jwt_exp` = 7 days), so **no middleware change is required** — current
  per-page server-client refresh continues to work.

## Out of scope (v1)

- Per-login 2FA / authenticator-app MFA.
- "Sign in with Apple" (separate deferred item).
- Middleware-based session refresh (not needed).

## Build order

1. Supabase config — email templates, Google provider, password policy.
2. `AuthShell` extraction + `GoogleButton` + `OtpCodeInput`.
3. `LoginForm` (+ `/login`).
4. `SignupForm` with code verify (+ `/signup`).
5. `ForgotPasswordForm` (+ `/forgot-password`).
6. Trim `/auth/confirm`; delete `AuthScreen.tsx`.
7. Proactive migration email to passwordless users.
8. End-to-end verify in preview; deploy.

## External dependency

- **Google OAuth Client ID + Secret** from Gordon's Google Cloud account — the
  only blocker, and only for the Google button. All other work can proceed and
  ship without it.

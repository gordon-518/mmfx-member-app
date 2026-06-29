# Email+Password Auth, Email-Code Verification & Google Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic-link auth with email+password login, a 6-digit email code at signup (verify-once), and "Continue with Google" — eliminating the cross-context email-link failures that have plagued magic links.

**Architecture:** "Codes, not links." Signup and password-reset use a 6-digit OTP the user types in the same tab (no link click). Google uses OAuth (manages its own session) via the existing `/auth/confirm` `?code=` exchange. The overloaded `AuthScreen.tsx` is split into a visual shell + focused per-flow client forms.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19, `@supabase/ssr` + `@supabase/supabase-js` v2, Tailwind, Vitest (Node). Supabase project `dldrcitoeoxzfctsqlmo`.

**Conventions (follow exactly):**
- Tests run in Node via Vitest; **no jsdom** → unit-test pure logic + route handlers only, mock Supabase with `vi.hoisted`/`vi.mock` (see `src/app/api/kys/send-copy/route.test.ts`). UI forms are verified with the `preview_*` workflow, not unit tests.
- Client components are `"use client"`; browser Supabase client = `createClient()` from `@/lib/supabase/client`; server client from `@/lib/supabase/server`.
- Preserve existing warm-premium visuals (tokens, `rise` animation, `font-display`, `text-orange`, `bg-paper`, etc.).
- Frequent commits. Run `npm run lint` and `npx tsc --noEmit` before considering a UI task done.

---

## File Structure

**Create:**
- `src/lib/auth/password.ts` — `validatePassword(pw)` pure helper (single source of truth for the 8-char rule).
- `src/lib/auth/password.test.ts` — unit tests for the helper.
- `src/lib/auth/authErrors.ts` — maps Supabase auth error messages → friendly, enumeration-safe copy.
- `src/lib/auth/authErrors.test.ts` — unit tests for the mapper.
- `src/components/auth/AuthShell.tsx` — brand panel + layout + logo (extracted from `AuthScreen`).
- `src/components/auth/GoogleButton.tsx` — "Continue with Google" + "or" divider.
- `src/components/auth/OtpCodeInput.tsx` — controlled 6-digit code field (used by signup + forgot).
- `src/components/auth/LoginForm.tsx` — email+password form.
- `src/components/auth/SignupForm.tsx` — name+email+password → code-verify.
- `src/components/auth/ForgotPasswordForm.tsx` — email → code → new password.
- `src/app/forgot-password/page.tsx` — renders shell + `ForgotPasswordForm`.
- `scripts/send-password-migration-email.ts` — one-time proactive email to passwordless users (dry-run by default).

**Modify:**
- `src/app/login/page.tsx` — render shell + `LoginForm` (drop magic-link copy).
- `src/app/signup/page.tsx` — render shell + `SignupForm`.
- `src/app/auth/confirm/route.ts` — keep `?code=` (Google) + token_hash fallback for in-flight links; tidy comments.

**Delete:**
- `src/components/AuthScreen.tsx` — after all three forms exist and pages are migrated.

**Out of code (Management API):** email templates → `{{ .Token }}`, `mailer_otp_length` 8→6, `password_min_length` 6→8.

---

## Task 1: Supabase config — codes instead of links, 6-digit OTP, 8-char passwords

**Files:** none (Management API). Token in `.env.local` as `SUPABASE_ACCESS_TOKEN` (30-day validity).

⚠️ **PATCH only the keys below.** Do NOT send any `smtp_*` key — changing `smtp_pass` resets `rate_limit_email_sent` to 2/hr.

- [ ] **Step 1: Read current templates** (already captured): confirmation + recovery use `{{ .ConfirmationURL }}`.

- [ ] **Step 2: PATCH auth config**

```bash
cd /Users/gordon/Documents/Claude/mmfx-member-app
TOKEN=$(grep -E '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -X PATCH "https://api.supabase.com/v1/projects/dldrcitoeoxzfctsqlmo/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "mailer_otp_length": 6,
    "password_min_length": 8,
    "mailer_templates_confirmation_content": "<h2>Confirm your email address</h2>\n<p>Enter this 6-digit code to finish creating your Market Makers FX account:</p>\n<p style=\"font-size:28px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>\n<p>This code expires in 1 hour. If you didn'\''t request it, you can ignore this email.</p>",
    "mailer_templates_recovery_content": "<h2>Reset your password</h2>\n<p>Enter this 6-digit code to set a new password:</p>\n<p style=\"font-size:28px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>\n<p>This code expires in 1 hour. If you didn'\''t request it, you can ignore this email.</p>"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('otp_len:', d['mailer_otp_length']); print('pw_min:', d['password_min_length']); print('confirm_has_token:', '{{ .Token }}' in d['mailer_templates_confirmation_content']); print('recovery_has_token:', '{{ .Token }}' in d['mailer_templates_recovery_content']); print('smtp_pass_untouched_host:', d['smtp_host']); print('rate_limit_email_sent:', d['rate_limit_email_sent'])"
```

- [ ] **Step 3: Verify output** — expect `otp_len: 6`, `pw_min: 8`, both `*_has_token: True`, `rate_limit_email_sent: 1000` (NOT 2). If rate limit shows 2, immediately PATCH it back to 1000.

- [ ] **Step 4: Update subject lines** (optional polish, same PATCH style):

```bash
curl -s -X PATCH "https://api.supabase.com/v1/projects/dldrcitoeoxzfctsqlmo/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"mailer_subjects_confirmation":"Your Market Makers FX code: {{ .Token }}","mailer_subjects_recovery":"Your password reset code: {{ .Token }}"}' >/dev/null && echo "subjects updated"
```

No commit (external config). Record completion in the spec's config section.

---

## Task 2: Password validation helper (TDD)

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `src/lib/auth/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  it("rejects shorter than 8 chars", () => {
    expect(validatePassword("a1b2c3d").ok).toBe(false);
  });
  it("rejects all-letters (no number)", () => {
    expect(validatePassword("abcdefgh").ok).toBe(false);
  });
  it("rejects all-numbers (no letter)", () => {
    expect(validatePassword("12345678").ok).toBe(false);
  });
  it("accepts 8+ chars with a letter and a number", () => {
    expect(validatePassword("trade2026").ok).toBe(true);
  });
  it("returns a human message when invalid", () => {
    expect(validatePassword("short").message).toMatch(/8/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run src/lib/auth/password.test.ts` → "Failed to resolve import".

- [ ] **Step 3: Implement**

```ts
/** Single source of truth for the signup/reset password rule.
 *  Mirrors Supabase's server-side policy (min length 8) and adds a soft
 *  letter+digit requirement enforced client-side for better UX. */
export type PasswordCheck = { ok: boolean; message: string };

export function validatePassword(pw: string): PasswordCheck {
  if (pw.length < 8) {
    return { ok: false, message: "Use at least 8 characters." };
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, message: "Include at least one letter and one number." };
  }
  return { ok: true, message: "" };
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit** — `git add src/lib/auth/password.* && git commit -m "feat(auth): password validation helper"`

---

## Task 3: Auth error mapper (TDD)

**Files:**
- Create: `src/lib/auth/authErrors.ts`
- Test: `src/lib/auth/authErrors.test.ts`

Supabase returns raw messages like `Invalid login credentials`, `Email not confirmed`, `User already registered`. Map them to friendly, enumeration-safe copy.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./authErrors";

describe("friendlyAuthError", () => {
  it("maps invalid credentials without revealing which field", () => {
    expect(friendlyAuthError("Invalid login credentials"))
      .toMatch(/email or password/i);
  });
  it("maps unconfirmed email to a verify hint", () => {
    expect(friendlyAuthError("Email not confirmed")).toMatch(/verify/i);
  });
  it("maps already-registered to a sign-in nudge", () => {
    expect(friendlyAuthError("User already registered")).toMatch(/already/i);
  });
  it("maps invalid/expired otp", () => {
    expect(friendlyAuthError("Token has expired or is invalid"))
      .toMatch(/code/i);
  });
  it("falls back to a generic message", () => {
    expect(friendlyAuthError("some unknown thing")).toMatch(/try again/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
/** Translate Supabase auth error strings into friendly, enumeration-safe copy. */
export function friendlyAuthError(raw: string | undefined): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email or password doesn't match. Try again, or reset your password.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email first — check your inbox for the code.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "You already have an account with this email — try signing in.";
  }
  if (m.includes("token has expired") || m.includes("invalid") && m.includes("token")) {
    return "That code is wrong or expired. Request a new one.";
  }
  if (m.includes("for security purposes") || m.includes("rate limit")) {
    return "Too many attempts — please wait a minute and try again.";
  }
  return "Something went wrong. Please try again.";
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git commit -am "feat(auth): friendly enumeration-safe error mapper"`

---

## Task 4: AuthShell + GoogleButton + OtpCodeInput (visual scaffolding)

Extract the brand panel/layout from `AuthScreen.tsx` verbatim (same markup/classes) into `AuthShell`, and build the two shared widgets. No behavior change yet.

**Files:** Create `src/components/auth/AuthShell.tsx`, `GoogleButton.tsx`, `OtpCodeInput.tsx`.

- [ ] **Step 1: `AuthShell.tsx`** — a client component exporting `AuthShell({ children })` that renders the `<main>` + atmosphere divs + desktop `<aside>` brand panel + mobile logo, with `{children}` placed in the form `<section>`. Copy the JSX from `AuthScreen.tsx` lines 95–146 and 283–287 (the wrapper + brand panel), replacing the form body with `{children}`. Keep the `Logo`/`Check` helpers here (move them out of `AuthScreen`).

- [ ] **Step 2: `GoogleButton.tsx`**

```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/confirm` },
    });
    if (error) setLoading(false); // on success the browser redirects to Google
  }
  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-card px-6 py-3.5 text-[15px] font-semibold text-ink shadow-soft transition-all hover:bg-paper disabled:opacity-70"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
        </svg>
        {loading ? "Redirecting…" : label}
      </button>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `OtpCodeInput.tsx`** — controlled single text input, `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, strips non-digits, big tracked font. Props: `{ value, onChange, autoFocus? }`. Style to match the email field (rounded-xl border, focus ring).

```tsx
"use client";
export function OtpCodeInput({
  value, onChange, autoFocus,
}: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-center text-2xl font-bold tracking-[0.5em] text-ink placeholder:text-faint focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/15"
    />
  );
}
```

- [ ] **Step 4:** `npx tsc --noEmit` clean. **Commit** — `git commit -am "feat(auth): AuthShell + GoogleButton + OtpCodeInput scaffolding"`

---

## Task 5: LoginForm + /login

**Files:** Create `src/components/auth/LoginForm.tsx`; Modify `src/app/login/page.tsx`.

- [ ] **Step 1: `LoginForm.tsx`** — `"use client"`. State: `email`, `password`, `status` (`idle|sending|error`), `errorMsg`. Render `GoogleButton`, then email + password fields (password with show/hide toggle), submit button "Sign in", a "Forgot password?" link to `/forgot-password`, and "New here? Start your free trial" → `/signup`. On submit:

```tsx
const supabase = createClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { setErrorMsg(friendlyAuthError(error.message)); setStatus("error"); return; }
window.location.assign("/dashboard");
```

Reuse the email-field markup/classes from `AuthScreen`. Import `friendlyAuthError`.

- [ ] **Step 2: `/login/page.tsx`** — server component, keep `metadata` (update description: "Sign in with your email and password."), render:

```tsx
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
export default function LoginPage() {
  return <AuthShell><LoginForm /></AuthShell>;
}
```

- [ ] **Step 3:** `npm run lint` + `npx tsc --noEmit` clean.

- [ ] **Step 4: Preview-verify** — `preview_start`; navigate `/login`; `preview_snapshot` shows Google button + email/password + Forgot link. (Full sign-in tested end-to-end in Task 9.)

- [ ] **Step 5: Commit** — `git commit -am "feat(auth): password LoginForm + /login"`

---

## Task 6: SignupForm with email-code verify + /signup

**Files:** Create `src/components/auth/SignupForm.tsx`; Modify `src/app/signup/page.tsx`.

State machine: `form` → (signUp) → `verify` → (verifyOtp) → redirect. Status: `idle|sending|verifying|error`.

- [ ] **Step 1: `SignupForm.tsx`** — `"use client"`. Fields in `form` stage: name, email, password (with `validatePassword` gating + inline hint), plus `GoogleButton`. Keep the Layer-1 disposable-email block (`isDisposableEmail`) and `computeFingerprint()`.

Submit (form stage):
```tsx
if (isDisposableEmail(email)) { /* set error, return */ }
const pw = validatePassword(password);
if (!pw.ok) { setErrorMsg(pw.message); setStatus("error"); return; }
const supabase = createClient();
const { error } = await supabase.auth.signUp({
  email, password,
  options: { data: { full_name: name.trim(), fingerprint: computeFingerprint() } },
});
if (error) { setErrorMsg(friendlyAuthError(error.message)); setStatus("error"); return; }
setStage("verify");
```

Verify stage: render `OtpCodeInput` + "We sent a 6-digit code to {email}" + "Verify & continue" button + "Resend code" + "← Use a different email". Submit:
```tsx
const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
if (error) { setErrorMsg(friendlyAuthError(error.message)); setStatus("error"); return; }
window.location.assign("/dashboard");
```
Resend: `await supabase.auth.resend({ type: "signup", email })`.

- [ ] **Step 2: `/signup/page.tsx`** — render `<AuthShell><SignupForm /></AuthShell>`; keep/adjust `metadata` (remove "no password" claims).

- [ ] **Step 3:** lint + `tsc --noEmit` clean.

- [ ] **Step 4: Preview-verify** — `/signup` renders form; fill name/email/short-password → inline validation message appears (no network). (Real code-verify tested in Task 9 with a throwaway email.)

- [ ] **Step 5: Commit** — `git commit -am "feat(auth): SignupForm with 6-digit email verification + /signup"`

---

## Task 7: ForgotPasswordForm + /forgot-password

**Files:** Create `src/components/auth/ForgotPasswordForm.tsx`, `src/app/forgot-password/page.tsx`.

Three sub-stages: `request` → `code` → `reset`. This is also the migration path for the ~100+ passwordless users.

- [ ] **Step 1: `ForgotPasswordForm.tsx`** — `"use client"`.

`request` stage: email field + "Send reset code":
```tsx
const supabase = createClient();
const { error } = await supabase.auth.resetPasswordForEmail(email);
// Always advance to `code` even on error to avoid email enumeration.
setStage("code");
```

`code` stage: `OtpCodeInput` + "Verify code":
```tsx
const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
if (error) { setErrorMsg(friendlyAuthError(error.message)); setStatus("error"); return; }
setStage("reset"); // now holds a short-lived recovery session
```

`reset` stage: new-password field (+ `validatePassword`) + "Set password & sign in":
```tsx
const pw = validatePassword(password);
if (!pw.ok) { setErrorMsg(pw.message); setStatus("error"); return; }
const { error } = await supabase.auth.updateUser({ password });
if (error) { setErrorMsg(friendlyAuthError(error.message)); setStatus("error"); return; }
window.location.assign("/dashboard");
```
Include "Resend code" (`resetPasswordForEmail` again) and a back link to `/login`.

- [ ] **Step 2: `/forgot-password/page.tsx`**

```tsx
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
export const metadata: Metadata = { title: "Reset password — Market Makers FX" };
export default function ForgotPasswordPage() {
  return <AuthShell><ForgotPasswordForm /></AuthShell>;
}
```

- [ ] **Step 3:** lint + `tsc --noEmit` clean.

- [ ] **Step 4: Preview-verify** — `/forgot-password` renders the request stage.

- [ ] **Step 5: Commit** — `git commit -am "feat(auth): ForgotPasswordForm + /forgot-password (also passwordless-user migration path)"`

---

## Task 8: Trim /auth/confirm, delete AuthScreen, fix references

**Files:** Modify `src/app/auth/confirm/route.ts`; Delete `src/components/AuthScreen.tsx`.

- [ ] **Step 1:** Confirm nothing else imports `AuthScreen`:
  `grep -rn "AuthScreen" src/` → expect only the (now-replaced) login/signup pages and the file itself. Delete `src/components/AuthScreen.tsx`.

- [ ] **Step 2:** `/auth/confirm/route.ts` — keep the `?code=` (Google/OAuth PKCE) branch and the `token_hash` branch (still valid for any in-flight recovery/confirmation links and harmless to keep). Update the header comment to say the primary callers are now Google OAuth (`?code=`); magic-link UI is removed. No logic change required.

- [ ] **Step 3:** `npx tsc --noEmit` + `npm run lint` clean (catches dangling imports).

- [ ] **Step 4:** `npm run build` succeeds.

- [ ] **Step 5: Commit** — `git commit -am "refactor(auth): remove AuthScreen, retire magic-link UI, keep OAuth callback"`

---

## Task 9: End-to-end preview verification

**Files:** none (verification only). Use the `preview_*` tools. Real email codes arrive in a throwaway inbox you control.

- [ ] **Step 1:** `preview_start`; check `preview_console_logs`/`preview_logs` are clean on `/login`, `/signup`, `/forgot-password`.
- [ ] **Step 2: Signup happy path** — `/signup`, fill a throwaway email + valid password → submit → verify stage appears → retrieve the 6-digit code from the inbox → enter → lands on `/dashboard`. Confirm a `profiles` row was created (`trial_active`, `full_name` set).
- [ ] **Step 3: Login** — sign out, `/login`, same creds → `/dashboard`.
- [ ] **Step 4: Forgot/reset** — `/forgot-password` with that email → code → new password → `/dashboard`; then log in again with the NEW password.
- [ ] **Step 5: Google** — click "Continue with Google" → Google consent → back to `/dashboard`; confirm `profiles` row exists with `full_name` from Google. *(If Google still shows "Testing"/redirect-mismatch, capture the error and surface to Gordon — this is the one external-config dependency.)*
- [ ] **Step 6:** `preview_screenshot` of `/login` for the record. Fix any issue by editing source and re-verifying from Step 1.

---

## Task 10: Proactive migration email to passwordless users  ⛔ PAUSE FOR APPROVAL

**Files:** Create `scripts/send-password-migration-email.ts`.

- [ ] **Step 1:** Write the script: using `SUPABASE_SERVICE_ROLE_KEY`, list `auth.users` and select those with **no password set and email/Google not yet migrated** (i.e. users created via the old OTP flow). Compose a short SendPulse email (reuse `src/lib/sendpulse.ts` `sendEmail`) linking to `https://app.marketmakersfx.net/forgot-password` with subject "We've upgraded your Market Makers FX login". Default to **DRY RUN** (print recipient count + sample, send nothing) unless run with `--send`.
- [ ] **Step 2:** Run dry run: print the recipient count and the rendered email HTML.
- [ ] **Step 3: ⛔ STOP.** Show Gordon the recipient count + email copy. **Do not run `--send` without explicit approval.**
- [ ] **Step 4 (after approval):** Run with `--send`; respect SendPulse 5,000/hr limit; log successes/failures.
- [ ] **Step 5: Commit** — `git commit -am "chore(auth): one-time passwordless-user migration email script"`

---

## Task 11: Deploy  ⛔ PAUSE FOR APPROVAL

- [ ] **Step 1:** Ensure `main`-readiness: `npm run build` + full `npm run test` green; `git status` clean on `auth-password-google`.
- [ ] **Step 2: ⛔ STOP.** Summarize what's changing in production (login UX for ALL users) and confirm with Gordon before deploying.
- [ ] **Step 3 (after approval):** Merge `auth-password-google` → `main`, push (git-integration deploy) or `npx vercel --prod --yes`.
- [ ] **Step 4:** Smoke-test production `/login`, `/signup`, `/forgot-password`, Google on `app.marketmakersfx.net`.
- [ ] **Step 5:** Update memory (`mmfx-status-and-outstanding`) — magic link retired, password+Google live.

---

## Self-Review

- **Spec coverage:** signup-code-verify (T6), password login (T5), forgot/reset + migration path (T7), Google (T1 config + T4 button + T8 callback), templates/otp/password config (T1), component split (T4–T7), AuthScreen deletion (T8), proactive email (T10), error/edge handling (T2/T3 + enumeration-safe flows), deploy (T11). ✅ All spec sections mapped.
- **Placeholder scan:** none — every code step has real content; UI JSX reuses documented existing markup from `AuthScreen.tsx`.
- **Type consistency:** `validatePassword → {ok,message}`, `friendlyAuthError(string)→string`, `OtpCodeInput {value,onChange,autoFocus}`, `GoogleButton {label?}`, `AuthShell {children}` — consistent across tasks.
- **Note:** UI tasks are preview-verified, not unit-tested — matches repo (no jsdom/component tests). Pure logic (T2, T3) is TDD'd.

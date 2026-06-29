"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDisposableEmail } from "@/lib/disposableEmails";
import { computeFingerprint } from "@/lib/fingerprint";
import { validatePassword } from "@/lib/auth/password";
import { friendlyAuthError } from "@/lib/auth/authErrors";
import { GoogleButton } from "./GoogleButton";
import { OtpCodeInput } from "./OtpCodeInput";

type Stage = "form" | "verify";
type Status = "idle" | "sending" | "error";

export function SignupForm() {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resent, setResent] = useState(false);

  function fail(msg: string) {
    setErrorMsg(msg);
    setStatus("error");
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email || !password || status === "sending") return;

    if (isDisposableEmail(email)) {
      fail("Please use a permanent email address — temporary inboxes aren't supported.");
      return;
    }
    const pw = validatePassword(password);
    if (!pw.ok) {
      fail(pw.message);
      return;
    }

    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim(), fingerprint: computeFingerprint() } },
    });
    if (error) {
      fail(friendlyAuthError(error.message));
      return;
    }
    setStatus("idle");
    setStage("verify");
  }

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length < 6 || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    if (error) {
      fail(friendlyAuthError(error.message));
      return;
    }
    window.location.assign("/dashboard");
  }

  async function resend() {
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  const fieldBorder = (errored: boolean) =>
    `flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-all ${errored ? "border-red-300 ring-2 ring-red-100" : "border-line focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15"}`;

  if (stage === "verify") {
    return (
      <div className="rise">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="3" stroke="#c2410c" strokeWidth="2" />
            <path d="M4 7L12 13L20 7" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink">
          Enter your code
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-subtle">
          We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>. Enter it below to open your desk.
        </p>

        <form onSubmit={handleVerify} className="mt-6">
          <OtpCodeInput value={code} onChange={(v) => { setCode(v); if (status === "error") setStatus("idle"); }} autoFocus />

          {status === "error" && (
            <p role="alert" className="mt-2.5 text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === "sending" || code.length < 6}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Verifying…" : "Verify & continue"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-[13px]">
          <button type="button" onClick={resend} className="font-semibold text-orange hover:text-accent-ink">
            {resent ? "Code resent ✓" : "Resend code"}
          </button>
          <button
            type="button"
            onClick={() => { setStage("form"); setCode(""); setStatus("idle"); }}
            className="font-medium text-subtle hover:text-ink"
          >
            ← Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="rise text-[13px] font-semibold uppercase tracking-wider text-orange">
        14-day free trial
      </p>
      <h2 className="rise mt-2 font-display text-3xl font-bold tracking-tight text-ink" style={{ animationDelay: "0.04s" }}>
        Start your free trial
      </h2>
      <p className="rise mt-2 text-[15px] leading-relaxed text-subtle" style={{ animationDelay: "0.08s" }}>
        Full access to the MM System for gold — free for 14 days.
      </p>

      <div className="rise mt-8" style={{ animationDelay: "0.12s" }}>
        <GoogleButton label="Sign up with Google" />

        <form onSubmit={handleSignup}>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">Full name</label>
          <div className={`${fieldBorder(false)} mb-4`}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 16.5a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="name" type="text" autoComplete="name" required autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
          </div>

          <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">Email address</label>
          <div className={fieldBorder(status === "error")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 6L10 10.5L16.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="email" type="email" inputMode="email" autoComplete="email" required
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
              placeholder="you@example.com"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
          </div>

          <label htmlFor="password" className="mb-2 mt-4 block text-sm font-medium text-ink">Password</label>
          <div className={fieldBorder(status === "error")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="password" type={showPw ? "text" : "password"} autoComplete="new-password" required
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (status === "error") setStatus("idle"); }}
              placeholder="At least 8 characters"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-[13px] font-medium text-faint hover:text-subtle">
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-faint">8+ characters, with a letter and a number.</p>

          {status === "error" && (
            <p role="alert" className="mt-2.5 text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Creating…" : "Start free trial"}
            {status !== "sending" && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </form>
      </div>

      <p className="rise mt-6 text-center text-[13px] text-subtle" style={{ animationDelay: "0.18s" }}>
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-orange transition-colors hover:text-accent-ink">
          Sign in →
        </Link>
      </p>
      <p className="rise mt-6 text-center text-[12px] leading-relaxed text-faint" style={{ animationDelay: "0.2s" }}>
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline decoration-line-strong underline-offset-2 hover:text-accent-ink">Terms</Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-accent-ink">Privacy Policy</Link>.
      </p>
    </>
  );
}

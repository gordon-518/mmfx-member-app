"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/auth/password";
import { friendlyAuthError } from "@/lib/auth/authErrors";
import { OtpCodeInput } from "./OtpCodeInput";

type Stage = "request" | "code" | "reset";
type Status = "idle" | "sending" | "error";

export function ForgotPasswordForm() {
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resent, setResent] = useState(false);

  function fail(msg: string) {
    setErrorMsg(msg);
    setStatus("error");
  }

  const fieldBorder = (errored: boolean) =>
    `flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-all ${errored ? "border-red-300 ring-2 ring-red-100" : "border-line focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15"}`;

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    // Fire the reset; always advance regardless of outcome so we never reveal
    // whether an email is registered (enumeration-safe).
    await supabase.auth.resetPasswordForEmail(email);
    setStatus("idle");
    setStage("code");
  }

  async function handleCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length < 6 || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) {
      fail(friendlyAuthError(error.message));
      return;
    }
    setStatus("idle");
    setStage("reset");
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const pw = validatePassword(password);
    if (!pw.ok) {
      fail(pw.message);
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      fail(friendlyAuthError(error.message));
      return;
    }
    window.location.assign("/dashboard");
  }

  async function resend() {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  // ---- request stage ----
  if (stage === "request") {
    return (
      <>
        <p className="rise text-[13px] font-semibold uppercase tracking-wider text-orange">Account recovery</p>
        <h2 className="rise mt-2 font-display text-3xl font-bold tracking-tight text-ink" style={{ animationDelay: "0.04s" }}>
          Reset your password
        </h2>
        <p className="rise mt-2 text-[15px] leading-relaxed text-subtle" style={{ animationDelay: "0.08s" }}>
          Enter your email and we&apos;ll send a 6-digit code to set a new password.
        </p>

        <form onSubmit={handleRequest} className="rise mt-8" style={{ animationDelay: "0.12s" }}>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">Email address</label>
          <div className={fieldBorder(false)}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 6L10 10.5L16.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="email" type="email" inputMode="email" autoComplete="email" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <button
            type="submit" disabled={status === "sending"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Sending…" : "Send reset code"}
          </button>
        </form>

        <p className="rise mt-6 text-center text-[13px] text-subtle" style={{ animationDelay: "0.18s" }}>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-orange transition-colors hover:text-accent-ink">Back to sign in →</Link>
        </p>
      </>
    );
  }

  // ---- code stage ----
  if (stage === "code") {
    return (
      <div className="rise">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Enter your code</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-subtle">
          If <span className="font-semibold text-ink">{email}</span> has an account, a 6-digit code is on its way. Enter it below.
        </p>
        <form onSubmit={handleCode} className="mt-6">
          <OtpCodeInput value={code} onChange={(v) => { setCode(v); if (status === "error") setStatus("idle"); }} autoFocus />
          {status === "error" && <p role="alert" className="mt-2.5 text-sm text-red-600">{errorMsg}</p>}
          <button
            type="submit" disabled={status === "sending" || code.length < 6}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Verifying…" : "Verify code"}
          </button>
        </form>
        <div className="mt-5 flex items-center justify-between text-[13px]">
          <button type="button" onClick={resend} className="font-semibold text-orange hover:text-accent-ink">
            {resent ? "Code resent ✓" : "Resend code"}
          </button>
          <button type="button" onClick={() => { setStage("request"); setCode(""); setStatus("idle"); }} className="font-medium text-subtle hover:text-ink">
            ← Use a different email
          </button>
        </div>
      </div>
    );
  }

  // ---- reset stage ----
  return (
    <div className="rise">
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Set a new password</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-subtle">Choose a password for your account.</p>
      <form onSubmit={handleReset} className="mt-6">
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-ink">New password</label>
        <div className={fieldBorder(status === "error")}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
            <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            id="new-password" type={showPw ? "text" : "password"} autoComplete="new-password" required autoFocus
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
        {status === "error" && <p role="alert" className="mt-2.5 text-sm text-red-600">{errorMsg}</p>}
        <button
          type="submit" disabled={status === "sending"}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "sending" ? "Saving…" : "Set password & sign in"}
        </button>
      </form>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/authErrors";
import { GoogleButton } from "./GoogleButton";

type Status = "idle" | "sending" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(friendlyAuthError(error.message));
      setStatus("error");
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <>
      <p className="rise text-[13px] font-semibold uppercase tracking-wider text-orange">
        Member access
      </p>
      <h2 className="rise mt-2 font-display text-3xl font-bold tracking-tight text-ink" style={{ animationDelay: "0.04s" }}>
        Welcome back
      </h2>
      <p className="rise mt-2 text-[15px] leading-relaxed text-subtle" style={{ animationDelay: "0.08s" }}>
        Sign in to your Market Makers FX desk.
      </p>

      <div className="rise mt-8" style={{ animationDelay: "0.12s" }}>
        <GoogleButton label="Sign in with Google" />

        <form onSubmit={handleSubmit}>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">
            Email address
          </label>
          <div className={`flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-all ${status === "error" ? "border-red-300 ring-2 ring-red-100" : "border-line focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15"}`}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 6L10 10.5L16.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="you@example.com"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <Link href="/forgot-password" className="text-[13px] font-semibold text-orange transition-colors hover:text-accent-ink">
              Forgot password?
            </Link>
          </div>
          <div className={`flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-all ${status === "error" ? "border-red-300 ring-2 ring-red-100" : "border-line focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15"}`}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="Your password"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="text-[13px] font-medium text-faint hover:text-subtle">
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {status === "error" && (
            <p role="alert" className="mt-2.5 text-sm text-red-600">
              {errorMsg || "Something went wrong. Please try again."}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "sending" ? "Signing in…" : "Sign in"}
            {status !== "sending" && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </form>
      </div>

      <p className="rise mt-6 text-center text-[13px] text-subtle" style={{ animationDelay: "0.18s" }}>
        New to Market Makers FX?{" "}
        <Link href="/signup" className="font-semibold text-orange transition-colors hover:text-accent-ink">
          Start your free trial →
        </Link>
      </p>
    </>
  );
}

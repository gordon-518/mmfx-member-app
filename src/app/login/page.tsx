"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || status === "sending") return;

    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian px-5 py-12">
      {/* ---------- Atmosphere ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        {/* Signal-orange glow bleeding from the lower-right desk edge */}
        <div className="absolute -right-40 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full bg-orange/20 blur-[140px]" />
        <div className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-pearl/[0.03] blur-[120px]" />
        {/* Currency tokens, faint, drifting in the periphery */}
        <div className="absolute inset-0 select-none font-mono text-pearl/[0.04]">
          <span className="absolute left-[12%] top-[18%] text-7xl">$</span>
          <span className="absolute right-[16%] top-[24%] text-5xl">¥</span>
          <span className="absolute left-[20%] bottom-[16%] text-6xl">£</span>
          <span className="absolute right-[22%] bottom-[22%] text-7xl">€</span>
          <span className="absolute left-[46%] top-[8%] text-4xl">₿</span>
        </div>
        <div className="grain absolute inset-0 opacity-[0.18] mix-blend-soft-light" />
        {/* Top hairline accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* ---------- Card ---------- */}
      <section className="relative w-full max-w-md">
        {/* Eyebrow rail */}
        <div className="reveal mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          <span>Secure Desk Access</span>
          <span className="text-orange/80">LDN · NY</span>
        </div>

        <div className="reveal rounded-2xl border border-pearl/10 bg-graphite/80 p-8 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-10" style={{ animationDelay: "0.08s" }}>
          {/* Wordmark + swoosh */}
          <div className="mb-9">
            <h1 className="font-display text-2xl font-bold tracking-tight text-pearl">
              MARKET MAKERS <span className="text-orange">FX</span>
            </h1>
            <svg
              viewBox="0 0 240 14"
              className="mt-2 h-3 w-44"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 11 C 60 2, 150 2, 238 8"
                stroke="#FF5A1F"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="swoosh-path"
              />
            </svg>
          </div>

          {status === "sent" ? (
            <ConfirmationTicket email={email} />
          ) : (
            <>
              <h2 className="reveal font-display text-3xl font-semibold leading-tight text-pearl" style={{ animationDelay: "0.16s" }}>
                Trade the session.
              </h2>
              <p className="reveal mt-3 text-sm leading-relaxed text-muted" style={{ animationDelay: "0.22s" }}>
                Enter your email and we&apos;ll send a single-use access link.
                No passwords — discipline over friction.
              </p>

              <form onSubmit={handleSubmit} className="reveal mt-8" style={{ animationDelay: "0.28s" }}>
                <label
                  htmlFor="email"
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.28em] text-muted"
                >
                  Email Address
                </label>

                {/* Terminal-style command line */}
                <div
                  className={`group flex items-center gap-2 rounded-lg border bg-obsidian/60 px-3.5 transition-colors duration-200 ${
                    status === "error"
                      ? "border-orange/60"
                      : "border-pearl/15 focus-within:border-orange"
                  }`}
                >
                  <span className="font-mono text-orange" aria-hidden>
                    ›
                  </span>
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
                    placeholder="trader@desk.com"
                    className="w-full bg-transparent py-3.5 font-mono text-sm text-pearl placeholder:text-muted/50 focus:outline-none"
                  />
                  {email.length === 0 && (
                    <span className="caret font-mono text-sm text-orange" aria-hidden>
                      _
                    </span>
                  )}
                </div>

                {status === "error" && (
                  <p
                    role="alert"
                    className="mt-3 flex items-start gap-2 font-mono text-xs text-orange"
                  >
                    <span aria-hidden>✕</span>
                    <span>{errorMsg || "Could not send link. Try again."}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-orange px-6 py-4 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="absolute inset-0 -translate-x-full bg-pearl/25 transition-transform duration-500 group-hover:translate-x-full" />
                  <span className="relative">
                    {status === "sending" ? "Dispatching…" : "Send magic link"}
                  </span>
                  {status !== "sending" && (
                    <span className="relative transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                      →
                    </span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer disclosure — composed voice, compliance-safe */}
        <p className="reveal mt-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted/70" style={{ animationDelay: "0.34s" }}>
          Precision · Clarity · Conviction
        </p>
      </section>
    </main>
  );
}

/* The success state resolves into a trade-ticket confirmation block —
   echoing the brand's mono signal blocks (EUR/USD · SL · TP). */
function ConfirmationTicket({ email }: { email: string }) {
  return (
    <div className="reveal" style={{ animationDelay: "0.05s" }}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-orange/40 bg-orange/10 font-mono text-orange">
          ✓
        </span>
        <h2 className="font-display text-2xl font-semibold text-pearl">
          Link dispatched.
        </h2>
      </div>

      <div className="mt-6 rounded-lg border border-pearl/10 bg-obsidian/60 p-5 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-pearl/10 pb-3 uppercase tracking-[0.2em] text-muted">
          <span>Access Link</span>
          <span className="text-orange">● live</span>
        </div>
        <dl className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">TO</dt>
            <dd className="truncate text-pearl">{email}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">TYPE</dt>
            <dd className="text-pearl">single-use · magic link</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">STATUS</dt>
            <dd className="text-orange">awaiting click</dd>
          </div>
        </dl>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted">
        Check your inbox and click the link to open your desk. You can close
        this tab — the link does the rest.
      </p>
    </div>
  );
}

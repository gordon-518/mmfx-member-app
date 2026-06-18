"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

/** Copy that differs between the sign-in and sign-up screens. All strings so
 *  the (server) page can pass it across the boundary to this client component. */
export type AuthCopy = {
  eyebrow: string;
  heading: string;
  subtext: string;
  submitLabel: string;
  sentHeading: string;
  sentBodyPre: string;
  sentBodyPost: string;
  footnote: string;
  altPrompt: string;
  altLabel: string;
  altHref: string;
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange shadow-soft">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M2 13L6.5 7.5L9.5 10.5L16 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="3" r="1.6" fill="white" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-bold tracking-tight text-ink">
        Market Makers <span className="text-orange">FX</span>
      </span>
    </div>
  );
}

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function AuthScreen({ copy, collectName = false }: { copy: AuthCopy; collectName?: boolean }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || (collectName && !name.trim()) || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm`,
        // Captured on /signup; the handle_new_user trigger copies it into profiles.full_name.
        ...(collectName ? { data: { full_name: name.trim() } } : {}),
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="relative flex min-h-screen justify-center overflow-hidden bg-paper">
      {/* Full-bleed warm atmosphere on <main> — its edges are the viewport, not
          a capped panel, so there's no visible seam. Content sits centered on top. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(52rem_44rem_at_27%_16%,#FFEEE2,transparent_70%)]" />
        <div className="absolute left-[6%] top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange/12 blur-[140px]" />
        <div className="absolute bottom-0 left-[20%] h-[24rem] w-[24rem] rounded-full bg-[#FFD9C6]/30 blur-[130px]" />
      </div>

      <div className="relative grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-[5fr_6fr]">
      {/* ---------- Brand panel (desktop) ---------- */}
      <aside className="hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="rise relative">
          <Logo />
        </div>

        <div className="relative max-w-md">
          <h1 className="rise font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink xl:text-5xl" style={{ animationDelay: "0.05s" }}>
            Trade gold with a system, not a guess.
          </h1>
          <p className="rise mt-5 text-[15px] leading-relaxed text-subtle" style={{ animationDelay: "0.12s" }}>
            The full MM System for XAU/USD — indicators, daily analysis, live
            classes, and signals, in one calm place built for discipline.
          </p>

          <ul className="rise mt-8 space-y-3.5" style={{ animationDelay: "0.18s" }}>
            {[
              "14 days of full access, free",
              "Daily analysis + a few high-conviction signals a day",
              "Indicators, the video course & twice-weekly live classes",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] text-ink">
                <Check />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rise relative text-[13px] text-faint" style={{ animationDelay: "0.24s" }}>
          Education-first. Trade the London &amp; New York sessions.
        </p>
      </aside>

      {/* ---------- Form panel ---------- */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>

          {status === "sent" ? (
            <div className="rise">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12.5L10 17.5L19 7" stroke="#c2410c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink">
                {copy.sentHeading}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-subtle">
                {copy.sentBodyPre}
                <span className="font-semibold text-ink">{email}</span>
                {copy.sentBodyPost}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
                className="mt-7 text-sm font-semibold text-orange transition-colors hover:text-accent-ink"
              >
                ← Use a different email
              </button>
            </div>
          ) : (
            <>
              <p className="rise text-[13px] font-semibold uppercase tracking-wider text-orange">
                {copy.eyebrow}
              </p>
              <h2 className="rise mt-2 font-display text-3xl font-bold tracking-tight text-ink" style={{ animationDelay: "0.04s" }}>
                {copy.heading}
              </h2>
              <p className="rise mt-2 text-[15px] leading-relaxed text-subtle" style={{ animationDelay: "0.08s" }}>
                {copy.subtext}
              </p>

              <form onSubmit={handleSubmit} className="rise mt-8" style={{ animationDelay: "0.12s" }}>
                {collectName && (
                  <div className="mb-4">
                    <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
                      Full name
                    </label>
                    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 transition-all focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
                        <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M4 16.5a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        required
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">
                  Email address
                </label>
                <div
                  className={`flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-all ${
                    status === "error"
                      ? "border-red-300 ring-2 ring-red-100"
                      : "border-line focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15"
                  }`}
                >
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
                    autoFocus={!collectName}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    placeholder="you@example.com"
                    className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
                  />
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
                  {status === "sending" ? "Sending…" : copy.submitLabel}
                  {status !== "sending" && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                      <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </form>

              <p className="rise mt-6 text-center text-[13px] text-faint" style={{ animationDelay: "0.16s" }}>
                {copy.footnote}
              </p>
              <p className="rise mt-3 text-center text-[13px] text-subtle" style={{ animationDelay: "0.18s" }}>
                {copy.altPrompt}{" "}
                <Link href={copy.altHref} className="font-semibold text-orange transition-colors hover:text-accent-ink">
                  {copy.altLabel} →
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
      </div>
    </main>
  );
}

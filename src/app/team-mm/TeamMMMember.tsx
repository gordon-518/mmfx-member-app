"use client";

import { useState } from "react";

// Team MM — the private VIP desk, for funded members. Invites are added BY HAND
// (the desk verifies + sends a personal invite) so the link can't be forwarded.
// So the CTA opens a DM to the desk rather than a raw channel-join link.

const REQUEST_URL = "https://t.me/m/FtwoPlcaMjFl"; // DM the desk → manual verify + personal invite
const BOSS_HANDLE = "@MMFX_BOSS";

const STEPS = [
  { n: 1, title: "Tap “Request your invite”", body: "It opens a private chat with the desk on Telegram." },
  { n: 2, title: "We verify and invite you", body: "The desk checks you’re not already in, then sends a personal invite link — just for you." },
  { n: 3, title: "Join & turn on notifications", body: "So you never miss a Team MM signal or call." },
];

function TelegramGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21.5 4.2 3.4 11.1c-1 .38-1 1.8.05 2.06l4.4 1.1 1.7 5.2c.26.8 1.3.98 1.82.32l2.3-2.86 4.4 3.24c.66.48 1.6.12 1.77-.68l3.1-14.4c.2-.94-.72-1.7-1.6-1.36Z" fill="currentColor" />
    </svg>
  );
}

export function TeamMMMember({ firstName }: { firstName: string }) {
  const [copied, setCopied] = useState(false);

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(BOSS_HANDLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:py-12">
      {/* Header */}
      <div className="rise">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-accent-ink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Team MM · you&apos;re in
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Welcome to Team MM{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-subtle">
          The private desk. Higher-conviction signals, member-only calls, and direct
          updates from Don — kept small and kept private.
        </p>
      </div>

      {/* The invite card */}
      <div
        className="rise relative mt-7 overflow-hidden rounded-3xl border border-orange/20 bg-card p-6 shadow-soft-lg sm:p-8"
        style={{ animationDelay: "0.06s" }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent-soft/60" />
        <div className="relative">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">Get your invite</p>
          <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-ink">
            Invites are sent by hand — just for you
          </h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-subtle">
            To keep Team MM private, the desk adds every member personally. Tap below
            to message us — we&apos;ll confirm you&apos;re not already in and send your
            own invite link. Please don&apos;t share it; it&apos;s tied to you.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={REQUEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-[#229ED9] px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:brightness-105 hover:shadow-soft-lg"
            >
              <TelegramGlyph />
              Request your invite
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <button
              type="button"
              onClick={copyHandle}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-paper"
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-green-600">
                    <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied {BOSS_HANDLE}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-faint">
                    <rect x="5" y="5" width="8" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  Save {BOSS_HANDLE}
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-[12px] text-faint">
            {BOSS_HANDLE} is one of only two official desk accounts. Anyone else is not us.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="rise mt-8" style={{ animationDelay: "0.12s" }}>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">How it works</p>
        <ol className="mt-3 space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3.5 rounded-2xl border border-line bg-card p-4 shadow-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange text-[14px] font-bold text-white">
                {s.n}
              </span>
              <div>
                <p className="text-[15px] font-bold tracking-tight text-ink">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-subtle">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

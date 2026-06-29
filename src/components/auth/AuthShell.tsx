import type { ReactNode } from "react";

/** Visual shell shared by every auth screen (login, signup, forgot password).
 *  Full-bleed warm atmosphere + desktop brand panel; the form column renders
 *  {children}. Extracted verbatim from the former AuthScreen so the look is
 *  unchanged. */

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

export function AuthShell({ children }: { children: ReactNode }) {
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
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

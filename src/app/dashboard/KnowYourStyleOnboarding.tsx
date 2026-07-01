import Link from "next/link";

/** Dashboard onboarding hero: nudges a trader to complete Know Your Style before
 *  anything else. Rendered as the first block on the desk until the user has
 *  completed KYS (see page.tsx `showKysOnboarding`). Static content + one link. */

function Compass({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.5 8.5L13.2 13.2L8.5 15.5L10.8 10.8L15.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KnowYourStyleOnboarding() {
  return (
    <div className="rise relative overflow-hidden rounded-3xl border border-orange/20 bg-card p-6 shadow-soft-lg sm:p-8">
      {/* warm halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-soft/70"
      />
      <div className="relative flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-accent-ink">
            <Compass size={14} />
            Start here
          </span>
          <h2 className="mt-3.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-[27px]">
            Know your trading style
          </h2>
          <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-subtle">
            Answer a few quick questions and get your trader archetype — the
            foundation for how you read, enter, and manage every trade here.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/bots/know-your-style"
              className="group inline-flex items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
            >
              Discover your style
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span className="text-[13px] text-faint">~3 min · 14 questions</span>
          </div>
        </div>
        <span className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-accent-soft text-orange sm:flex">
          <Compass size={52} />
        </span>
      </div>
    </div>
  );
}

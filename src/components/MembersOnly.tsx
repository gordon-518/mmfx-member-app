import Link from "next/link";
import type { ReactNode } from "react";

/** Reusable "members-only" lock/upsell panel. Any member-exclusive page renders
 *  this in place of its content when the viewer isn't a funded member. Drives to
 *  the /upgrade funnel. Warm-premium, matches the app. */

export interface Perk {
  icon: ReactNode;
  label: string;
}

const DEFAULT_PERKS: Perk[] = [
  {
    label: "Team MM — the private VIP signals channel",
    icon: (
      <path d="M4 11l16-7-7 16-2.5-6.5L4 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    ),
  },
  {
    label: "The AI trading journal",
    icon: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  {
    label: "Automated EAs — coming soon",
    icon: (
      <>
        <rect x="4.5" y="7" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 7V4.5M15 7V4.5M9.5 12h.01M14.5 12h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
];

function PerkIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

export function MembersOnly({
  feature,
  blurb,
  perks = DEFAULT_PERKS,
}: {
  feature: string;
  blurb: string;
  perks?: Perk[];
}) {
  return (
    <div className="mx-auto max-w-xl px-5 py-14 sm:py-20">
      <div className="rise relative overflow-hidden rounded-3xl border border-orange/20 bg-card p-7 text-center shadow-soft-lg sm:p-10">
        {/* warm atmosphere */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(30rem_18rem_at_50%_0%,#FFEEE2,transparent_70%)]" />
        </div>

        <div className="relative">
          {/* lock medallion */}
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft shadow-soft">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden className="text-orange">
              <rect x="4.5" y="10" width="15" height="10" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="15" r="1.4" fill="currentColor" />
            </svg>
          </span>

          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.2em] text-orange">Members only</p>
          <h1 className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            {feature} is for MM System members
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-subtle">{blurb}</p>

          {/* perks */}
          <ul className="mx-auto mt-7 grid max-w-sm gap-2.5 text-left">
            {perks.map((p, i) => (
              <li
                key={i}
                className="rise flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-3.5 py-3"
                style={{ animationDelay: `${0.06 * (i + 1)}s` }}
              >
                <PerkIcon>{p.icon}</PerkIcon>
                <span className="text-[14px] font-medium text-ink">{p.label}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/upgrade"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            Become a member
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform group-hover:translate-x-0.5">
              <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="mt-3.5 text-[12.5px] text-faint">
            You&apos;re on a free trial — fund your own broker account to unlock everything.
          </p>
        </div>
      </div>
    </div>
  );
}

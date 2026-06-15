"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentType, SVGProps } from "react";
import { signOut } from "./actions";
import { headerContent } from "./headerContent";
import type { AccountStatus, AccessTier } from "@/lib/trial/status";
import {
  HomeIcon, IndicatorsIcon, StrategiesIcon, LibraryIcon, CourseIcon,
  AnalysisIcon, SignalsIcon, LiveIcon, StyleIcon, DeskIcon,
  ArrowIcon, LockIcon, LogoutIcon,
} from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Surface {
  key: string;
  label: string;
  title: string;
  desc: string;
  href: string;
  icon: Icon;
  wide?: boolean;
}

const SURFACES: Surface[] = [
  { key: "daily-analysis", label: "Desk", title: "Daily Analysis", desc: "The read on gold, session by session — bias, levels and the thesis behind them.", href: "/daily-analysis", icon: AnalysisIcon, wide: true },
  { key: "course", label: "Education", title: "Video Course", desc: "The full MM System curriculum, lesson by lesson.", href: "/course", icon: CourseIcon, wide: true },
  { key: "indicators", label: "Tools", title: "Indicators", desc: "The TradingView suite, keyed to you.", href: "/indicators", icon: IndicatorsIcon },
  { key: "strategies", label: "Tools", title: "Strategies", desc: "Backtestable setups you can audit.", href: "/strategies", icon: StrategiesIcon },
  { key: "signals", label: "Live", title: "Signals", desc: "A few high-conviction calls a day.", href: "/signals", icon: SignalsIcon },
  { key: "live-classes", label: "Live", title: "Live Classes", desc: "Twice a week, on the charts.", href: "/live-classes", icon: LiveIcon },
  { key: "library", label: "Library", title: "eBook Library", desc: "The written system & references.", href: "/library", icon: LibraryIcon },
  { key: "know-your-style", label: "Bots", title: "Know Your Style", desc: "Find your trader archetype.", href: "/bots/know-your-style", icon: StyleIcon },
  { key: "fundamental-desk", label: "Bots", title: "Fundamental Desk", desc: "Live macro read on gold.", href: "/bots/fundamental", icon: DeskIcon },
];

const NAV: { label: string; href: string; icon: Icon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Indicators", href: "/indicators", icon: IndicatorsIcon },
  { label: "Strategies", href: "/strategies", icon: StrategiesIcon },
  { label: "Library", href: "/library", icon: LibraryIcon },
  { label: "Course", href: "/course", icon: CourseIcon },
  { label: "Daily Analysis", href: "/daily-analysis", icon: AnalysisIcon },
  { label: "Signals", href: "/signals", icon: SignalsIcon },
  { label: "Live Classes", href: "/live-classes", icon: LiveIcon },
  { label: "Know Your Style", href: "/bots/know-your-style", icon: StyleIcon },
  { label: "Fundamental Desk", href: "/bots/fundamental", icon: DeskIcon },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange shadow-soft">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M2 13L6.5 7.5L9.5 10.5L16 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="3" r="1.6" fill="white" />
        </svg>
      </span>
      <span className="font-display text-[15px] font-bold tracking-tight text-ink">
        Market Makers <span className="text-orange">FX</span>
      </span>
    </div>
  );
}

export function DashboardClient({
  email,
  accountStatus,
  daysLeft,
  tier,
}: {
  email: string;
  accountStatus: AccountStatus;
  daysLeft: number;
  tier: AccessTier;
}) {
  const head = headerContent(accountStatus, daysLeft);
  const locked = tier !== "Full";
  const isMember = accountStatus === "member_active";
  const firstName = email.split("@")[0];

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---------------- Sidebar ---------------- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <div className="px-2">
          <Wordmark />
        </div>

        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const active = n.href === "/dashboard";
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "text-subtle hover:bg-paper hover:text-ink"
                }`}
              >
                <n.icon className={active ? "text-orange" : "text-faint group-hover:text-subtle"} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold uppercase text-accent-ink">
              {firstName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{email}</span>
              <span className="block text-[11px] text-faint">
                {isMember ? "Member" : tier === "Full" ? "Trial · Full access" : "Limited access"}
              </span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-paper hover:text-ink"
              >
                <LogoutIcon />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 lg:hidden">
          <Wordmark />
          <form action={signOut}>
            <button type="submit" aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-card">
              <LogoutIcon />
            </button>
          </form>
        </div>

        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
          {/* Greeting */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <p className="text-[15px] text-subtle">Welcome back,</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink first-letter:uppercase">
              {firstName}
            </h1>
          </motion.div>

          {/* Status hero */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={`mt-6 overflow-hidden rounded-2xl border p-6 shadow-soft sm:p-7 ${
              head.cta?.kind === "push"
                ? "border-orange/25 bg-gradient-to-br from-[#FFF1E9] to-card"
                : "border-line bg-card"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{head.eyebrow}</p>
                <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">{head.title}</h2>
                {head.body && <p className="mt-1.5 text-[14px] leading-relaxed text-subtle">{head.body}</p>}
              </div>

              {head.cta ? (
                head.cta.kind === "push" ? (
                  <Link href={head.cta.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg">
                    {head.cta.label} <ArrowIcon width={16} height={16} />
                  </Link>
                ) : (
                  <Link href={head.cta.href} className="shrink-0 text-[14px] font-semibold text-orange transition-colors hover:text-accent-ink">
                    {head.cta.label} →
                  </Link>
                )
              ) : (
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Funded member
                </span>
              )}
            </div>
          </motion.div>

          {/* Surfaces — bento grid */}
          <div className="mt-9 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-bold text-ink">Your desk</h3>
            {locked && <span className="text-[13px] text-subtle">Unlock everything with full access</span>}
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {SURFACES.map((s) => {
              const span = s.wide ? "sm:col-span-2" : "";
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                      <s.icon width={20} height={20} />
                    </span>
                    {locked ? (
                      <LockIcon width={16} height={16} className="text-faint" />
                    ) : (
                      <ArrowIcon width={18} height={18} className="text-faint transition-all group-hover:translate-x-0.5 group-hover:text-orange" />
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{s.label}</p>
                    <h4 className="mt-1 font-display text-[17px] font-bold tracking-tight text-ink">{s.title}</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-subtle">{s.desc}</p>
                  </div>
                </>
              );

              return (
                <motion.div key={s.key} variants={item} className={span}>
                  {locked ? (
                    <Link
                      href="/upgrade"
                      className="group flex h-full cursor-pointer flex-col rounded-2xl border border-line bg-card p-5 opacity-75 shadow-soft transition-all hover:opacity-100 hover:shadow-soft-lg"
                      aria-label={`${s.title} — upgrade to unlock`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <Link
                      href={s.href}
                      className="group flex h-full cursor-pointer flex-col rounded-2xl border border-line bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
                    >
                      {inner}
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

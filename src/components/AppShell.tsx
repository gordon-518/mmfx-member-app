"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { signOut } from "@/app/dashboard/actions";
import type { AccountStatus, AccessTier } from "@/lib/trial/status";
import {
  HomeIcon, IndicatorsIcon, StrategiesIcon, LibraryIcon, CourseIcon,
  AnalysisIcon, SignalsIcon, LiveIcon, StyleIcon, DeskIcon, LogoutIcon,
} from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

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

export function Wordmark() {
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

/**
 * The warm-premium app shell — persistent left sidebar (desktop) + mobile top
 * bar, wrapping every gated member page. Active nav item is derived from the
 * pathname. Pages render their own content as children inside <main>.
 */
export function AppShell({
  email,
  accountStatus,
  tier,
  children,
}: {
  email: string;
  accountStatus: AccountStatus;
  tier: AccessTier;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isMember = accountStatus === "member_active";
  const firstName = email.split("@")[0];

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="px-2">
          <Wordmark />
        </Link>

        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const active =
              n.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
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
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-paper hover:text-ink"
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
        <div className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 lg:hidden">
          <Link href="/dashboard">
            <Wordmark />
          </Link>
          <form action={signOut}>
            <button type="submit" aria-label="Sign out" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-subtle transition-colors hover:bg-paper hover:text-ink">
              <LogoutIcon />
            </button>
          </form>
        </div>

        {children}
      </main>
    </div>
  );
}

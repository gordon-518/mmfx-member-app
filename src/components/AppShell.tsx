"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { signOut } from "@/app/dashboard/actions";
import type { AccountStatus, AccessTier } from "@/lib/trial/status";
import {
  HomeIcon, IndicatorsIcon, StrategiesIcon, LibraryIcon, CourseIcon,
  AnalysisIcon, SignalsIcon, LiveIcon, StyleIcon, DeskIcon, LogoutIcon, NewsIcon, CalendarIcon,
  MenuIcon, CloseIcon,
} from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const NAV: { label: string; href: string; icon: Icon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Indicators", href: "/indicators", icon: IndicatorsIcon },
  { label: "Strategies", href: "/strategies", icon: StrategiesIcon },
  { label: "Library", href: "/library", icon: LibraryIcon },
  { label: "Course", href: "/course", icon: CourseIcon },
  { label: "Daily Analysis", href: "/daily-analysis", icon: AnalysisIcon },
  { label: "News & Articles", href: "/news", icon: NewsIcon },
  { label: "Economic Calendar", href: "/calendar", icon: CalendarIcon },
  { label: "Signals", href: "/signals", icon: SignalsIcon },
  { label: "Live Classes", href: "/live-classes", icon: LiveIcon },
  { label: "Know Your Style", href: "/bots/know-your-style", icon: StyleIcon },
  { label: "Fundamental Desk", href: "/bots/fundamental", icon: DeskIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(`${href}/`);
}

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

/** Nav link list — shared by the desktop sidebar and the mobile drawer. */
function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
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
    </>
  );
}

/** Account row with sign-out — shared by the desktop sidebar and the mobile drawer. */
function UserCard({
  email,
  firstName,
  isMember,
  tier,
}: {
  email: string;
  firstName: string;
  isMember: boolean;
  tier: AccessTier;
}) {
  return (
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
  );
}

/**
 * The warm-premium app shell — persistent left sidebar (desktop) + a mobile top
 * bar with a slide-out navigation drawer, wrapping every gated member page. The
 * sidebar and the drawer render from the same NAV list and shared sub-components,
 * so navigation stays in sync across breakpoints. Active nav item is derived from
 * the pathname; pages render their own content as children inside <main>.
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
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  // While the drawer is open: lock body scroll and close on Escape.
  // (Tapping a nav link closes it via each link's onNavigate handler.)
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const slide = reduceMotion
    ? { duration: 0 }
    : { type: "tween" as const, ease: [0.22, 1, 0.36, 1] as const, duration: 0.3 };

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="px-2">
          <Wordmark />
        </Link>

        <nav className="mt-8 flex-1 space-y-0.5 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <UserCard email={email} firstName={firstName} isMember={isMember} tier={tier} />
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/80 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              className="-ml-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-subtle transition-colors hover:bg-paper hover:text-ink"
            >
              <MenuIcon />
            </button>
            <Link href="/dashboard">
              <Wordmark />
            </Link>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-subtle transition-colors hover:bg-paper hover:text-ink"
            >
              <LogoutIcon />
            </button>
          </form>
        </div>

        {children}
      </main>

      {/* ---------------- Mobile nav drawer ---------------- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial="closed"
            animate="open"
            exit="closed"
          >
            {/* Scrim */}
            <motion.div
              className="absolute inset-0 bg-ink/40"
              variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Panel */}
            <motion.aside
              className="absolute left-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col border-r border-line bg-card px-4 py-6 shadow-soft-lg"
              variants={{ open: { x: 0 }, closed: { x: "-100%" } }}
              transition={slide}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="flex items-center justify-between px-2">
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                  <Wordmark />
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="-mr-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-subtle transition-colors hover:bg-paper hover:text-ink"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
                <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </nav>

              <div className="mt-4 border-t border-line pt-4">
                <UserCard email={email} firstName={firstName} isMember={isMember} tier={tier} />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

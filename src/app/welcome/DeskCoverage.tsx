import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  AnalysisIcon, CalendarIcon, CourseIcon, DeskIcon, IndicatorsIcon, JournalIcon,
  LibraryIcon, LiveIcon, LockIcon, NewsIcon, SignalsIcon, StrategiesIcon,
  StyleIcon, TelegramIcon, CheckIcon,
} from "@/components/icons";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/access/featureKeys";
import { FEATURE_HREF, canAccess, type Viewer } from "@/lib/access/features";

// Which of the desk's tools this member has actually opened. Not a guess:
// requireFeature logs a feature_view for every granted page view, and
// fn_my_features reads the member's own rows back. Locked tools are shown as
// locked rather than as "not opened" — a Free member hasn't skipped Live
// Classes, they can't reach it yet.

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const META: Record<FeatureKey, { label: string; icon: Icon }> = {
  "daily-analysis": { label: "Daily Analysis", icon: AnalysisIcon },
  "fundamental-desk": { label: "Fundamental Desk", icon: DeskIcon },
  news: { label: "News", icon: NewsIcon },
  calendar: { label: "Calendar", icon: CalendarIcon },
  signals: { label: "Signals", icon: SignalsIcon },
  indicators: { label: "Indicators", icon: IndicatorsIcon },
  strategies: { label: "Strategies", icon: StrategiesIcon },
  "live-classes": { label: "Live Classes", icon: LiveIcon },
  "know-your-style": { label: "Know Your Style", icon: StyleIcon },
  "ai-trading-assistant": { label: "AI Assistant", icon: JournalIcon },
  "team-mm": { label: "Team MM", icon: TelegramIcon },
  course: { label: "The Course", icon: CourseIcon },
  library: { label: "Library", icon: LibraryIcon },
};

export function DeskCoverage({ opened, viewer }: { opened: string[]; viewer: Viewer }) {
  const seen = new Set(opened);
  const rows = FEATURE_KEYS.map((key) => ({
    key,
    ...META[key],
    href: FEATURE_HREF[key],
    open: canAccess(key, viewer),
    used: seen.has(key),
  }));
  const reachable = rows.filter((r) => r.open);
  const usedCount = reachable.filter((r) => r.used).length;
  const locked = rows.length - reachable.length;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
            The tools you can use
          </p>
          <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-tight text-ink">
            You&apos;ve opened {usedCount} of your {reachable.length}
          </h3>
        </div>
        {locked > 0 && (
          <p className="text-[12.5px] text-faint">
            {locked} more {locked === 1 ? "unlocks" : "unlock"} on a higher tier
          </p>
        )}
      </div>

      {/* one segment per reachable tool, filled from the left: it reads as
          progress, not as a map of which tile is which. */}
      <div className="mt-3 flex gap-1" aria-hidden>
        {reachable.map((r, i) => (
          <span
            key={r.key}
            className={`h-1.5 flex-1 rounded-full ${i < usedCount ? "bg-orange" : "bg-line"}`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => {
          const Icon = r.icon;
          const body = (
            <>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  r.used ? "bg-orange text-white" : r.open ? "bg-accent-soft text-accent-ink" : "bg-paper text-faint"
                }`}
              >
                <Icon width={16} height={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{r.label}</span>
                <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-faint">
                  {r.used ? "Opened" : r.open ? "Not yet" : "Locked"}
                </span>
              </span>
              {r.used ? (
                <CheckIcon width={13} height={13} strokeWidth={2.6} className="shrink-0 text-orange" />
              ) : !r.open ? (
                <LockIcon width={13} height={13} className="shrink-0 text-faint" />
              ) : null}
            </>
          );
          return (
            <li key={r.key}>
              {r.open ? (
                <Link
                  href={r.href}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-paper/60 p-2.5 transition-all hover:-translate-y-0.5 hover:border-orange/35 hover:bg-card hover:shadow-soft"
                >
                  {body}
                </Link>
              ) : (
                <Link
                  href="/upgrade"
                  className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong p-2.5 opacity-70 transition-opacity hover:opacity-100"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

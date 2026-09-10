import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LockedOverlay } from "@/lib/access/LockedOverlay";
import { FEATURE_HREF, FEATURE_MIN_TIER } from "@/lib/access/features";
import { tierUnlockLabel } from "@/lib/tiers";
import type { FeatureKey } from "@/lib/access/featureKeys";
import type { FeatureGate } from "@/lib/access/requireFeature";

// The locked state of a feature page (conversion-fix 2.4). A Free user who
// opens a locked route sees what it is, a preview under the lock veil and the
// way to unlock it, instead of being bounced to /upgrade. Nothing gated is
// fetched to render it: the preview is static art and copy.
//
// Copy stays compliance-safe: it says what the tool is, never what it earns.

interface LockedCopy {
  eyebrow: string;
  title: string;
  pitch: string;
  points: string[];
  image?: { src: string; width: number; height: number };
}

const COPY: Partial<Record<FeatureKey, LockedCopy>> = {
  signals: {
    eyebrow: "Desk · Signals",
    title: "Signals",
    pitch: "Trade calls from the desk on XAU/USD, each with the levels and the reasoning behind it.",
    points: ["Entry, stop and targets on every call", "The thesis behind the trade", "Posted as the desk takes them"],
  },
  indicators: {
    eyebrow: "Tools · TradingView",
    title: "Indicators",
    pitch: "The MM System's invite-only TradingView indicators, granted straight to your TradingView username.",
    points: ["Auto trendlines, pivots and multi-timeframe views", "On your own charts, in TradingView", "Access granted automatically"],
    image: { src: "/indicators/auto-trendlines-cover.png", width: 1200, height: 675 },
  },
  strategies: {
    eyebrow: "Tools · TradingView",
    title: "Strategies",
    pitch: "Backtestable TradingView strategy scripts that encode the MM System's rules.",
    points: ["Run the rules over history yourself", "Entry models from the course, as code", "On your own charts, in TradingView"],
    image: { src: "/strategies/mm-system-5m-entry.jpg", width: 1200, height: 675 },
  },
  library: {
    eyebrow: "Education · Library",
    title: "MM Library",
    pitch: "The four MM eBooks: the system, its playbooks and the thinking behind them.",
    points: ["The MM System, written down", "Playbooks you can keep beside the chart", "Download and read offline"],
    image: { src: "/dashboard/spotlight-course.jpg", width: 1200, height: 675 },
  },
  "live-classes": {
    eyebrow: "Education · Live",
    title: "Live Classes",
    pitch: "Sessions on the charts with the desk, reading the market as it moves.",
    points: ["Live on the charts with the desk", "Ask questions as it happens", "Replays of past sessions"],
    image: { src: "/dashboard/spotlight-live.jpg", width: 1200, height: 675 },
  },
  "fundamental-desk": {
    eyebrow: "Bots · Macro",
    title: "Fundamental Desk",
    pitch: "A live macro read on gold: the fundamental picture driving XAU/USD, in plain English.",
    points: ["What's moving gold today, and why", "Rates, the dollar and risk in one read", "Updated through the session"],
    image: { src: "/dashboard/spotlight-fundamental.jpg", width: 1200, height: 675 },
  },
  "ai-trading-assistant": {
    eyebrow: "Team MM · AI",
    title: "AI Trading Assistant",
    pitch: "Connect your trading account and get a coach that reviews every trade you take against the MM System.",
    points: ["Every trade reviewed automatically", "Patterns in your own trading, spotted for you", "Built around the MM System"],
  },
  "team-mm": {
    eyebrow: "Team MM · Community",
    title: "Team MM",
    pitch: "The private Team MM channel, with the desk.",
    points: ["Straight from the desk", "Team MM members only", "On Telegram"],
  },
};

const FREE_LINKS: { label: string; feature: FeatureKey }[] = [
  { label: "Daily Analysis", feature: "daily-analysis" },
  { label: "Economic Calendar", feature: "calendar" },
  { label: "News", feature: "news" },
  { label: "Know Your Style", feature: "know-your-style" },
  { label: "Course · Module 1", feature: "course" },
];

export function LockedFeature({ feature, gate }: { feature: FeatureKey; gate: FeatureGate }) {
  const copy = COPY[feature] ?? {
    eyebrow: "Locked",
    title: "This part of the desk is locked",
    pitch: "It opens when you fund your account.",
    points: [],
  };
  // Tier-specific CTA (conversion-fix 2.4 / 3.3): say which tier opens it.
  const min = FEATURE_MIN_TIER[feature];
  const { profile, viewer } = gate;

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} memberTier={viewer.tier} isAdmin={profile.is_admin}>
      <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:px-8 lg:pt-10">
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">{copy.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">{copy.pitch}</p>
        </div>

        <div className="rise mt-7" style={{ animationDelay: "80ms" }}>
          <LockedOverlay
            ctaHref="/upgrade"
            ctaLabel={min === "free" ? "Open on every plan" : `Unlocks at ${tierUnlockLabel(min)}`}
          >
            <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
              {copy.image && (
                <Image
                  src={copy.image.src}
                  alt=""
                  width={copy.image.width}
                  height={copy.image.height}
                  className="h-auto w-full rounded-xl"
                />
              )}
              {copy.points.length > 0 && (
                <ul className={`grid grid-cols-1 gap-2.5 sm:grid-cols-3 ${copy.image ? "mt-4" : ""}`}>
                  {copy.points.map((p) => (
                    <li key={p} className="rounded-xl border border-line bg-paper/60 px-4 py-3 text-[13.5px] font-medium text-ink">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </LockedOverlay>
        </div>

        <div className="rise mt-6 rounded-2xl border border-line bg-card p-5 shadow-soft" style={{ animationDelay: "140ms" }}>
          <p className="text-[13.5px] font-semibold text-ink">Open on your plan right now</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FREE_LINKS.map((l) => (
              <Link
                key={l.feature}
                href={FEATURE_HREF[l.feature]}
                className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

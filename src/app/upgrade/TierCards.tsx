import type { ComponentType, SVGProps } from "react";
import {
  CourseIcon, LibraryIcon, IndicatorsIcon, StrategiesIcon, SignalsIcon, LiveIcon, DeskIcon,
  JournalIcon, TelegramIcon, LockIcon,
} from "@/components/icons";
import { TIER_RANK, TIER_THRESHOLDS, tierLabel, type MemberTier, type PaidTier } from "@/lib/tiers";

// The three paid tiers on /upgrade (conversion-fix 3.6). Contents are the
// plan's tier feature matrix; each tier includes everything below it.
// Compliance: this says what each tier opens, never what it earns. The
// thresholds are cumulative deposits to the member's own trading account.

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const TIERS: { tier: PaidTier; pitch: string; items: { label: string; icon: Icon }[]; note?: string }[] = [
  {
    tier: "foundation",
    pitch: "Learn the system, get the tools on your charts",
    items: [
      { label: "The full course, all 19 lessons", icon: CourseIcon },
      { label: "The MM Library, 4 eBooks", icon: LibraryIcon },
      { label: "10 TradingView indicators", icon: IndicatorsIcon },
      { label: "Strategy scripts", icon: StrategiesIcon },
    ],
  },
  {
    tier: "desk",
    pitch: "Take the calls",
    items: [
      { label: "Signals from the desk", icon: SignalsIcon },
      { label: "Live classes", icon: LiveIcon },
      { label: "The Fundamental Desk", icon: DeskIcon },
    ],
    note: "We don't send calls to an account that can't survive them.",
  },
  {
    tier: "team",
    pitch: "The full desk",
    items: [
      { label: "The AI Trading Assistant", icon: JournalIcon },
      { label: "The private Team MM channel", icon: TelegramIcon },
    ],
  },
];

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function TierCards({ memberTier, cumulative }: { memberTier: MemberTier; cumulative: number }) {
  const paid = memberTier === "foundation" || memberTier === "desk" || memberTier === "team";

  return (
    <ol className="mt-3 space-y-3">
      {TIERS.map((t, i) => {
        const threshold = TIER_THRESHOLDS[t.tier];
        // A trial is Desk-equivalent in access but hasn't deposited, so only
        // real (paid) tiers count as "yours" here.
        const current = memberTier === t.tier;
        const unlocked = paid && TIER_RANK[memberTier] > TIER_RANK[t.tier];
        const topUp = paid && !current && !unlocked ? Math.max(0, threshold - cumulative) : null;

        return (
          <li
            key={t.tier}
            className={`rounded-2xl border bg-card p-5 shadow-soft ${
              current ? "border-orange/50 ring-2 ring-orange/15" : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl font-bold tracking-tight text-ink">
                {tierLabel(t.tier)}{" "}
                <span className="text-[14px] font-semibold text-orange">{fmtUsd(threshold)}+</span>
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {current
                  ? "Your tier"
                  : unlocked
                    ? "Included"
                    : topUp != null
                      ? `Top up ${fmtUsd(topUp)} to unlock`
                      : `Deposit ${fmtUsd(threshold)} to unlock`}
              </span>
            </div>
            <p className="mt-0.5 text-[13.5px] text-subtle">{t.pitch}</p>
            {i > 0 && (
              <p className="mt-3 text-[11.5px] font-medium text-faint">
                Everything in {tierLabel(TIERS[i - 1].tier)}, plus:
              </p>
            )}
            <ul className={`${i > 0 ? "mt-1.5" : "mt-3"} grid grid-cols-1 gap-2 sm:grid-cols-2`}>
              {t.items.map((item) => (
                <li
                  key={item.label}
                  className="relative flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-3.5 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-faint">
                    <item.icon className="h-[16px] w-[16px]" />
                  </span>
                  <span className="min-w-0 text-[13px] font-medium text-ink">{item.label}</span>
                  {!current && !unlocked && (
                    <LockIcon aria-hidden className="absolute right-3 top-3 h-3 w-3 text-faint/60" />
                  )}
                </li>
              ))}
            </ul>
            {t.note && <p className="mt-3 text-[12.5px] italic leading-relaxed text-subtle">{t.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

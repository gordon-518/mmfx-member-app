import { CARD_ROWS, PAID_TIERS, TIER_CONTENT, includes } from "@/lib/upgradeContent";
import { TIER_RANK, TIER_THRESHOLDS, tierLabel, type MemberTier } from "@/lib/tiers";

// The three paid tiers on /upgrade, outcome-first (redesign inspired by
// Higgsfield's pricing cards):
//   * a persona line and what the tier ADDS, in one sentence
//   * every paid feature on every card: the included ones ticked, the rest
//     greyed with "from <tier>", so the gap is visible (loss framing, honestly)
//   * escalating tint, a "Most complete" badge on Team MM, one clear CTA
// The member's own (earned) tier is highlighted, and lower tiers read "Included".

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-orange">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TINT: Record<string, string> = {
  foundation: "bg-card",
  desk: "bg-gradient-to-b from-[#FFF7F1] to-card",
  team: "bg-gradient-to-b from-[#FFEBDD] to-card",
};

export function TierCards({
  earnedTier,
  cumulative,
  isMember,
}: {
  earnedTier: MemberTier;
  cumulative: number;
  isMember: boolean;
}) {
  const paid = earnedTier === "foundation" || earnedTier === "desk" || earnedTier === "team";

  return (
    <ol className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PAID_TIERS.map((tier) => {
        const c = TIER_CONTENT[tier];
        const threshold = TIER_THRESHOLDS[tier];
        const current = earnedTier === tier;
        const unlocked = paid && TIER_RANK[earnedTier] > TIER_RANK[tier];
        const topUp = Math.max(0, threshold - cumulative);

        return (
          <li
            key={tier}
            className={`relative flex flex-col rounded-2xl border p-5 shadow-soft ${TINT[tier]} ${
              current ? "border-orange/60 ring-2 ring-orange/20" : tier === "team" ? "border-orange/30" : "border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl font-bold tracking-tight text-ink">{tierLabel(tier)}</p>
                <p className="mt-0.5 text-[12.5px] text-subtle">{c.persona}</p>
              </div>
              {c.badge && !current && (
                <span className="shrink-0 rounded-full bg-orange px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
                  {c.badge}
                </span>
              )}
              {current && (
                <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
                  Your tier
                </span>
              )}
            </div>

            <p className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">
              {usd(threshold)}
              <span className="ml-1 text-[13px] font-semibold text-subtle">in total deposits</span>
            </p>
            <p className="mt-1 text-[12.5px] font-medium text-orange">It stays in your own trading account.</p>

            <p className="mt-4 text-[14px] leading-relaxed text-ink">{c.adds}</p>

            <div className="mt-4">
              {current ? (
                <span className="block rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-[13.5px] font-semibold text-subtle">
                  You&apos;re here
                </span>
              ) : unlocked ? (
                <span className="block rounded-xl border border-line bg-paper px-4 py-2.5 text-center text-[13.5px] font-semibold text-subtle">
                  Included in your tier
                </span>
              ) : (
                <a
                  href={isMember ? "#submit-deposit" : "#get-started"}
                  className={`block rounded-xl px-4 py-2.5 text-center text-[13.5px] font-semibold transition-colors ${
                    tier === "team"
                      ? "bg-orange text-white shadow-soft hover:bg-[#f24e12]"
                      : "border border-line-strong bg-card text-ink hover:border-orange/40 hover:text-accent-ink"
                  }`}
                >
                  {isMember ? `Top up ${usd(topUp)}` : `Start with ${usd(threshold)}`}
                </a>
              )}
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">Plus everything on Free</p>
            <ul className="mt-2 space-y-1.5">
              {CARD_ROWS.map((row) => {
                const has = includes(tier, row);
                return (
                  <li key={row.key} className={`flex items-center gap-2 text-[13px] ${has ? "text-ink" : "text-faint"}`}>
                    {has ? <Tick /> : <span aria-hidden className="inline-block w-[14px] shrink-0 text-center">·</span>}
                    <span className={has ? "" : "line-through decoration-line-strong/70"}>{row.label}</span>
                    {!has && (
                      <span className="ml-auto shrink-0 text-[11px] font-medium text-faint">from {tierLabel(row.min)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {c.note && <p className="mt-4 text-[12.5px] italic leading-relaxed text-subtle">{c.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

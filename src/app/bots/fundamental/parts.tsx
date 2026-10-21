import Link from "next/link";
import { ExternalIcon } from "@/components/icons";
import { confidencePct, convictionSegments } from "@/lib/fa/format";
import { DESK_ORIGIN } from "@/lib/fa/desk";
import type { Bias, DeskState } from "@/lib/fa/types";

// Shared presentational pieces for the native Fundamental Desk. No hooks, so
// the server views render them directly.

/** Bias colour follows /daily-analysis: bullish peach, bearish ink, neutral paper. */
const BIAS_CLASS: Record<Bias, string> = {
  bullish: "bg-accent-soft text-accent-ink",
  bearish: "bg-ink/5 text-ink",
  neutral: "bg-paper text-subtle",
};

function BiasArrow({ bias }: { bias: Bias }) {
  // Direction, drawn — the icon set is SVG-only (no emoji, no glyph chars).
  const d =
    bias === "bullish"
      ? "M3 9.5 7 3l4 6.5z"
      : bias === "bearish"
        ? "M3 3.5h8L7 10z"
        : "M2.5 6.5h9";
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 13"
      aria-hidden
      fill={bias === "neutral" ? "none" : "currentColor"}
      stroke={bias === "neutral" ? "currentColor" : "none"}
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

export function BiasPill({
  bias,
  size = "sm",
}: {
  bias: Bias | null;
  size?: "sm" | "lg";
}) {
  const b = bias ?? "neutral";
  const pad = size === "lg" ? "px-3 py-1 text-[12px]" : "px-2.5 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${pad} ${BIAS_CLASS[b]}`}
    >
      <BiasArrow bias={b} />
      {bias ?? "no bias"}
    </span>
  );
}

/** FRESH / WATCH / STALE (desk BUILD.md §9), as a dotted status chip. */
const STATE_DOT: Record<DeskState, string> = {
  FRESH: "bg-green-500 ring-green-500/15",
  WATCH: "bg-orange ring-orange/15",
  STALE: "bg-faint ring-faint/20",
};

const STATE_HINT: Record<DeskState, string> = {
  FRESH: "Recent, and price is in line with the thesis",
  WATCH: "Aging, or price is near its invalidation line",
  STALE: "Past its freshness window, or the line has broken",
};

export function StateBadge({ state }: { state: DeskState | null }) {
  if (!state) return null;
  return (
    <span
      title={STATE_HINT[state]}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-subtle"
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ring-2 ${STATE_DOT[state]}`} />
      {state}
    </span>
  );
}

/** Conviction = the desk's own confidence, as a 10-segment bar. */
export function ConvictionBar({
  confidence,
  showValue = true,
}: {
  confidence: number | null;
  showValue?: boolean;
}) {
  const lit = convictionSegments(confidence);
  const pct = confidencePct(confidence);
  return (
    <div>
      {showValue && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Conviction
          </span>
          <span className="text-[12px] font-bold text-ink">{pct}%</span>
        </div>
      )}
      <div
        className="flex gap-1"
        role="img"
        aria-label={`Conviction ${pct} percent`}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-1.5 flex-1 rounded-full ${i < lit ? "bg-orange" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** A titled card — the house panel for every block of the thesis. */
export function Panel({
  title,
  meta,
  children,
  delay,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section
      className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {meta && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The honest failure state. The desk's data is served from its own box, so an
 * outage there is a real possibility — say so, and keep the door to the desk's
 * own dashboard open rather than showing an empty panel.
 */
export function DeskUnreachable({
  title,
  detail,
  backHref,
}: {
  title: string;
  detail: string;
  backHref?: string;
}) {
  return (
    <div className="rise rounded-2xl border border-line bg-card p-8 text-center shadow-soft">
      <p className="font-display text-lg font-bold tracking-tight text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-subtle">{detail}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a
          href={DESK_ORIGIN}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
        >
          Open the desk <ExternalIcon width={15} height={15} />
        </a>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-card px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
          >
            Back to the desk grid
          </Link>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { DIMENSIONS } from "@/lib/kys/dimensions";
import type { DimensionScores } from "@/lib/kys/types";

// The six trader dimensions as a shape. Know Your Style already scores them
// 0–100 (all oriented "higher = healthier"), so this draws the member's own
// profile — not an illustration. Before they take it, the same hexagon is
// drawn empty: the six labels still say what the desk measures, and the
// missing shape is the reason to go and take it.

const SHORT: Record<string, string> = {
  risk_discipline: "Risk",
  emotional_control: "Emotion",
  independent_conviction: "Conviction",
  decisiveness: "Decisiveness",
  consistency: "Consistency",
  process_routine: "Process",
};

const CX = 150;
const CY = 132;
const R = 84;

function point(i: number, radius: number) {
  const a = (-90 + i * 60) * (Math.PI / 180);
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)] as const;
}

function polygon(radii: number[]) {
  return radii.map((r, i) => point(i, r).join(",")).join(" ");
}

export function SkillsRadar({ scores }: { scores: DimensionScores | null }) {
  const values = DIMENSIONS.map((d) => (scores ? Number(scores[d.id] ?? 0) : 0));
  const taken = scores != null;

  const best = taken ? DIMENSIONS[values.indexOf(Math.max(...values))] : null;
  const leak = taken ? DIMENSIONS[values.indexOf(Math.min(...values))] : null;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">
        The skills you&apos;re building
      </p>
      <h3 className="mt-1.5 font-display text-[19px] font-bold tracking-tight text-ink">
        Six dimensions of how you trade
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
        {taken
          ? "Your own shape, scored from your answers. The short edge is the one to work on."
          : "The desk scores every trader on these six. Take the assessment and this fills in with your shape."}
      </p>

      <div className="mt-4 flex flex-col items-center gap-4">
        <svg
          viewBox="0 0 300 264"
          className="h-[232px] w-full max-w-[330px] shrink-0"
          role="img"
          aria-label={
            taken
              ? `Your six dimensions: ${DIMENSIONS.map((d, i) => `${d.name} ${values[i]}`).join(", ")}`
              : "The six dimensions, not yet scored"
          }
        >
          {/* rings */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={polygon(DIMENSIONS.map(() => R * f))}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="1"
            />
          ))}
          {/* spokes + labels */}
          {DIMENSIONS.map((d, i) => {
            const [x, y] = point(i, R);
            const [lx, ly] = point(i, R + 22);
            const anchor = Math.abs(lx - CX) < 6 ? "middle" : lx > CX ? "start" : "end";
            return (
              <g key={d.id}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-line)" strokeWidth="1" />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor={anchor}
                  className="fill-[var(--color-faint)] text-[11px] font-semibold"
                >
                  {SHORT[d.id] ?? d.name}
                </text>
                {taken && (
                  <text
                    x={lx}
                    y={ly + 17}
                    textAnchor={anchor}
                    className="fill-[var(--color-ink)] text-[11px] font-bold"
                  >
                    {values[i]}
                  </text>
                )}
              </g>
            );
          })}
          {/* the member's shape */}
          {taken && (
            <>
              <polygon
                points={polygon(values.map((v) => (Math.max(0, Math.min(100, v)) / 100) * R))}
                fill="var(--color-orange)"
                fillOpacity="0.16"
                stroke="var(--color-orange)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {values.map((v, i) => {
                const [x, y] = point(i, (Math.max(0, Math.min(100, v)) / 100) * R);
                return <circle key={i} cx={x} cy={y} r="3" fill="var(--color-orange)" />;
              })}
            </>
          )}
        </svg>

        <div className="w-full min-w-0">
          {taken ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-paper p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                  Your strongest
                </p>
                <p className="mt-0.5 text-[13.5px] font-bold text-ink">{best?.name}</p>
                <p className="text-[12px] text-subtle">{best?.highPole}</p>
              </div>
              <div className="rounded-xl border border-orange/25 bg-accent-soft/50 p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-accent-ink">
                  The one costing you
                </p>
                <p className="mt-0.5 text-[13.5px] font-bold text-ink">{leak?.name}</p>
                <p className="text-[12px] text-subtle">
                  Closer to &ldquo;{leak?.lowPole}&rdquo; than you want
                </p>
              </div>
              <Link
                href="/bots/know-your-style"
                className="text-[13px] font-semibold text-accent-ink underline underline-offset-4 transition-colors hover:text-orange sm:col-span-2"
              >
                Read your full profile →
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="text-[13px] leading-relaxed text-subtle">
                Fourteen questions, about six minutes. You get your archetype, these six scores and
                the habit costing you the most — in writing.
              </p>
              <Link
                href="/bots/know-your-style"
                className="mt-3 inline-flex rounded-xl bg-orange px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
              >
                Fill in your shape
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

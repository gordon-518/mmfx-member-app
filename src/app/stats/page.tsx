import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import {
  computeMetrics,
  type GrowthProfileRow,
  type GrowthMetrics,
} from "@/lib/growth/metrics";

// Admin-gated growth dashboard. Reads growth_daily snapshots (for trends +
// day-over-day / week-over-week deltas) and live-computes "current" totals from
// profiles, so the page is never stale between the 09:00-SGT snapshots.
// Aggregate counts only — no member PII.

export const dynamic = "force-dynamic";

const PROFILE_COLUMNS =
  "signup_at, account_status, trial_ends_at, deposit_verified_at, downgraded_at, broker, tradingview_username";

interface SnapshotRow {
  date: string;
  signups_today: number;
  signups_7d: number;
  signups_30d: number;
  trials_active: number;
  trials_expiring_48h: number;
  conversions_today: number;
  members_active: number;
  churn_today: number;
  tv_engagement_pct: number;
  narrative: string | null;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function fmtDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// ---- small presentational helpers (server-rendered, no client JS) ----------

function DeltaChip({ current, prior }: { current: number; prior?: number | null }) {
  if (prior == null) {
    return <span className="text-[11px] font-medium text-faint">— no baseline</span>;
  }
  const diff = current - prior;
  if (diff === 0) {
    return <span className="text-[11px] font-medium text-faint">flat</span>;
  }
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        up ? "text-accent-ink" : "text-subtle"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(diff)}
    </span>
  );
}

// Inline-SVG sparkline — no charting dependency, matches the plain admin ethos.
function Sparkline({
  values,
  stroke = "var(--color-orange)",
  fill = "var(--color-accent-soft)",
}: {
  values: number[];
  stroke?: string;
  fill?: string;
}) {
  const W = 240;
  const H = 56;
  const pad = 4;
  if (values.length < 2) {
    return <div className="h-14 text-[11px] text-faint">not enough history yet</div>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (H - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill={fill} opacity={0.6} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.6} fill={stroke} />
    </svg>
  );
}

function Card({
  label,
  value,
  sub,
  delta,
  weekDelta,
  current,
  prior,
  weekPrior,
  delay,
}: {
  label: string;
  value: number | string;
  sub?: string;
  current?: number;
  prior?: number | null;
  weekPrior?: number | null;
  delta?: boolean;
  weekDelta?: boolean;
  delay: number;
}) {
  return (
    <div
      className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-subtle">{sub}</p>}
      {(delta || weekDelta) && current != null && (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5">
          {delta && (
            <span className="flex items-center gap-1 text-[11px] text-subtle">
              <span className="text-faint">DoD</span>
              <DeltaChip current={current} prior={prior} />
            </span>
          )}
          {weekDelta && (
            <span className="flex items-center gap-1 text-[11px] text-subtle">
              <span className="text-faint">WoW</span>
              <DeltaChip current={current} prior={weekPrior} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TrendCard({
  title,
  values,
  latest,
  delay,
}: {
  title: string;
  values: number[];
  latest: string;
  delay: number;
}) {
  return (
    <div
      className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</p>
        <p className="font-display text-lg font-bold text-ink">{latest}</p>
      </div>
      <div className="mt-3">
        <Sparkline values={values} />
      </div>
    </div>
  );
}

export default async function GrowthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase.rpc("is_admin");
    isAdmin = data === true;
  }
  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-subtle">Not authorized.</p>
      </main>
    );
  }

  // Live "current" totals (admin RLS lets an admin read every profile row).
  const { data: profiles } = await supabase.from("profiles").select(PROFILE_COLUMNS);
  const live: GrowthMetrics = computeMetrics((profiles ?? []) as GrowthProfileRow[]);

  // Snapshot history for trends + deltas (most recent 30 days).
  const { data: snapData } = await supabase
    .from("growth_daily")
    .select(
      "date, signups_today, signups_7d, signups_30d, trials_active, trials_expiring_48h, conversions_today, members_active, churn_today, tv_engagement_pct, narrative"
    )
    .order("date", { ascending: false })
    .limit(30);
  const snaps = (snapData ?? []) as SnapshotRow[];

  const byDate = new Map(snaps.map((s) => [s.date, s]));
  const yesterday = byDate.get(shiftDate(live.date, -1)) ?? null;
  const lastWeek = byDate.get(shiftDate(live.date, -7)) ?? null;

  // Latest stored narrative (today's if present, else most recent snapshot).
  const narrative = byDate.get(live.date)?.narrative ?? snaps.find((s) => s.narrative)?.narrative ?? null;

  // Trend series in chronological order.
  const asc = [...snaps].reverse();
  const signupSeries = asc.map((s) => s.signups_today);
  const trialSeries = asc.map((s) => s.trials_active);
  const memberSeries = asc.map((s) => s.members_active);

  const b = live.broker_split;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/admin">
          <Wordmark />
        </Link>
        <span className="text-[13px] text-subtle">{user.email}</span>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Growth <span className="text-orange">·</span> Dashboard
            </h1>
            <p className="mt-1 text-[13px] text-subtle">
              Live as of now · snapshots at 09:00 SGT ·{" "}
              {snaps.length > 0
                ? `${snaps.length} day${snaps.length === 1 ? "" : "s"} of history`
                : "no snapshots yet"}
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink"
          >
            ← Members
          </Link>
        </div>

        {/* AI narrative banner */}
        {narrative ? (
          <section
            className="rise mt-6 rounded-2xl border border-orange/30 bg-accent-soft/40 p-5 shadow-soft"
            style={{ animationDelay: "0ms" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
              Today&apos;s read
            </p>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">{narrative}</p>
          </section>
        ) : (
          <section
            className="rise mt-6 rounded-2xl border border-line bg-card/60 p-5 text-[13px] text-subtle"
            style={{ animationDelay: "0ms" }}
          >
            No narrative yet — the 09:00 SGT cron writes it each morning.
          </section>
        )}

        {/* Headline cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card
            label="New signups"
            value={live.signups_today}
            sub={`${live.signups_7d} · 7d   ${live.signups_30d} · 30d`}
            current={live.signups_today}
            prior={yesterday?.signups_today}
            delta
            delay={40}
          />
          <Card
            label="Active trials"
            value={live.trials_active}
            current={live.trials_active}
            prior={yesterday?.trials_active}
            weekPrior={lastWeek?.trials_active}
            delta
            weekDelta
            delay={80}
          />
          <Card
            label="Expiring ≤48h"
            value={live.trials_expiring_48h}
            sub="active trials falling due"
            delay={120}
          />
          <Card
            label="Conversions today"
            value={live.conversions_today}
            current={live.conversions_today}
            prior={yesterday?.conversions_today}
            delta
            delay={160}
          />
          <Card
            label="Active members"
            value={live.members_active}
            current={live.members_active}
            prior={yesterday?.members_active}
            weekPrior={lastWeek?.members_active}
            delta
            weekDelta
            delay={200}
          />
          <Card
            label="Churn today"
            value={live.churn_today}
            sub="downgraded today"
            delay={240}
          />
        </div>

        {/* Secondary metrics */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card
            label="TV engagement"
            value={`${live.tv_engagement_pct}%`}
            sub="of members with a TradingView handle"
            delay={280}
          />
          <div
            className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
            style={{ animationDelay: "320ms" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Broker split (members)
            </p>
            <div className="mt-3 flex items-end gap-5">
              {[
                { name: "Octa", n: b.octa },
                { name: "Dupoin", n: b.dupoin },
                { name: "Elev8", n: b.elev8 },
              ].map((row) => (
                <div key={row.name}>
                  <p className="font-display text-2xl font-bold text-ink">{row.n}</p>
                  <p className="text-[12px] text-subtle">{row.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend charts */}
        <h2 className="mt-10 font-display text-lg font-bold tracking-tight text-ink">
          Trends <span className="text-orange">·</span> last {snaps.length || 0} days
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <TrendCard title="Daily signups" values={signupSeries} latest={String(live.signups_today)} delay={360} />
          <TrendCard title="Active trials" values={trialSeries} latest={String(live.trials_active)} delay={400} />
          <TrendCard title="Active members" values={memberSeries} latest={String(live.members_active)} delay={440} />
        </div>

        <p className="mt-8 pb-8 text-[12px] text-faint">
          Snapshot date {fmtDay(live.date)} (SGT). Headline numbers are live; deltas compare against stored
          daily snapshots.
        </p>
      </div>
    </main>
  );
}

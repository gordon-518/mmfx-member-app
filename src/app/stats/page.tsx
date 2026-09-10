import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/AppShell";
import {
  computeMetrics,
  computeConversion,
  bucketFlowMetrics,
  bucketSnapshotSeries,
  parsePeriod,
  GROWTH_PERIODS,
  type GrowthMetrics,
  type GrowthPeriod,
} from "@/lib/growth/metrics";
import { fetchAllGrowthProfiles } from "@/lib/growth/profiles";
import { summariseFunnel } from "@/lib/growth/funnel";

// Admin-gated growth dashboard with a Daily/Weekly/Monthly/Yearly toggle
// (?period=). Two metric families are handled differently:
//   * Flow metrics (signups, conversions, churn) are re-derived LIVE from raw
//     profiles across the full history — no snapshots, no backfill — so their
//     cards + sparklines re-scope with the period.
//   * Point-in-time metrics (active trials/members, expiring, TV %, broker)
//     can't be reconstructed historically, so their cards stay "live as of now"
//     and their sparklines come from the forward-only growth_daily snapshots.
// Aggregate counts only — no member PII.

export const dynamic = "force-dynamic";

interface SnapshotRow {
  date: string;
  signups_today: number;
  signups_7d: number;
  signups_30d: number;
  trials_active: number;
  trials_expiring_48h: number;
  conversions_today: number;
  members_active: number;
  // Null before 2026-09-10: the verified/legacy split wasn't measured then.
  members_verified: number | null;
  members_legacy: number | null;
  churn_today: number;
  tv_engagement_pct: number;
  narrative: string | null;
}

// Per-period copy + how far back to pull snapshots for the point-in-time trends.
const PERIOD_LABEL: Record<GrowthPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
const PERIOD_NOUN: Record<GrowthPeriod, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
};
const PERIOD_PRIOR: Record<GrowthPeriod, string> = {
  daily: "vs yesterday",
  weekly: "vs last week",
  monthly: "vs last month",
  yearly: "vs last year",
};
const PERIOD_WINDOW: Record<GrowthPeriod, string> = {
  daily: "last 30 days",
  weekly: "last 12 weeks",
  monthly: "last 12 months",
  yearly: "all years",
};
const SNAP_LIMIT: Record<GrowthPeriod, number> = {
  daily: 30,
  weekly: 100,
  monthly: 400,
  yearly: 1200,
};

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

// Small pill marking a card as live "as of now" rather than period-scoped.
function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden />
      Live
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
  deltaLabel,
  live,
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
  // When set (with `current`), render a single period delta row (e.g. "vs last month").
  deltaLabel?: string;
  // Marks the card as a live "as of now" value rather than period-scoped.
  live?: boolean;
  delay: number;
}) {
  return (
    <div
      className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
        {live && <LiveTag />}
      </div>
      <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-subtle">{sub}</p>}
      {deltaLabel && current != null ? (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
          <span className="text-[11px] text-faint">{deltaLabel}</span>
          <DeltaChip current={current} prior={prior} />
        </div>
      ) : (
        (delta || weekDelta) &&
        current != null && (
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
        )
      )}
    </div>
  );
}

function TrendCard({
  title,
  values,
  latest,
  note,
  delay,
}: {
  title: string;
  values: number[];
  latest: string;
  note?: string;
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
      {note && <p className="mt-2 text-[10px] text-faint">{note}</p>}
    </div>
  );
}

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);

  // Live "current" totals (admin RLS lets an admin read every profile row).
  // Paged fetch — a plain .select() caps at 1000 rows and would undercount.
  const profiles = await fetchAllGrowthProfiles(supabase);
  const live: GrowthMetrics = computeMetrics(profiles);
  // Every profile row is one signup (created by the handle_new_user trigger).
  const totalSignups = profiles.length;
  // Signup -> verified deposit, legacy excluded from both sides. Cumulative, so
  // it's derived live from profiles rather than read from a snapshot.
  const conv = computeConversion(profiles);

  // conversion-fix 1.5 — activation + the upgrade funnel. Aggregated in the DB
  // (app_events outgrows PostgREST's 1000-row page cap within days). A failed
  // call renders as zeros rather than breaking the dashboard.
  const { data: funnelRaw } = await supabase.rpc("fn_admin_funnel_stats", { p_days: 30 });
  const funnel = summariseFunnel(funnelRaw);

  // Flow metrics — re-derived live from raw profiles for the full history.
  const flow = bucketFlowMetrics(profiles, period);
  const cur = flow[flow.length - 1] ?? { signups: 0, conversions: 0, churn: 0 };
  const prev = flow.length >= 2 ? flow[flow.length - 2] : null;
  const signupSeries = flow.map((f) => f.signups);
  const conversionSeries = flow.map((f) => f.conversions);
  const churnSeries = flow.map((f) => f.churn);

  // Snapshot history for point-in-time trends + deltas + narrative.
  const { data: snapData } = await supabase
    .from("growth_daily")
    .select(
      "date, signups_today, signups_7d, signups_30d, trials_active, trials_expiring_48h, conversions_today, members_active, members_verified, members_legacy, churn_today, tv_engagement_pct, narrative"
    )
    .order("date", { ascending: false })
    .limit(SNAP_LIMIT[period]);
  const snaps = (snapData ?? []) as SnapshotRow[];

  const byDate = new Map(snaps.map((s) => [s.date, s]));
  const yesterday = byDate.get(shiftDate(live.date, -1)) ?? null;
  const lastWeek = byDate.get(shiftDate(live.date, -7)) ?? null;

  // Latest stored narrative (today's if present, else most recent snapshot).
  const narrative = byDate.get(live.date)?.narrative ?? snaps.find((s) => s.narrative)?.narrative ?? null;

  // Point-in-time trend series — bucketed from the forward-only snapshots.
  const trialSeries = bucketSnapshotSeries(
    snaps.map((s) => ({ date: s.date, value: s.trials_active })),
    period
  );
  const memberSeries = bucketSnapshotSeries(
    snaps.map((s) => ({ date: s.date, value: s.members_active })),
    period
  );
  // Forward-only: snapshots before 2026-09-10 didn't measure the split (null).
  const verifiedSeries = bucketSnapshotSeries(
    snaps
      .filter((s) => s.members_verified != null)
      .map((s) => ({ date: s.date, value: s.members_verified as number })),
    period
  );
  const snapNote = "from 09:00 SGT snapshots";

  const b = live.broker_split;

  const segActive =
    "rounded-lg bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink shadow-soft";
  const segIdle =
    "rounded-lg px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-accent-ink";

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
                ? `${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} on file`
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

        {/* Period toggle — Link-driven so the page re-renders server-side. */}
        <div className="rise mt-5 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-soft">
          {GROWTH_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/stats?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={p === period ? segActive : segIdle}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
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

        {/* All-time signups — the top of the funnel */}
        <div
          className="rise mt-6 rounded-2xl border border-orange/30 bg-accent-soft/30 p-5 shadow-soft"
          style={{ animationDelay: "0ms" }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
              Total signups · all-time
            </p>
            <LiveTag />
          </div>
          <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight text-ink">
            {totalSignups.toLocaleString()}
          </p>
          <p className="mt-1.5 text-[12px] text-subtle">
            {live.members_verified.toLocaleString()} verified members ·{" "}
            {live.members_legacy.toLocaleString()} legacy ·{" "}
            {live.trials_active.toLocaleString()} active trials
          </p>
        </div>

        {/* Flow metrics — period-scoped, derived live from profiles */}
        <h2 className="mt-8 font-display text-lg font-bold tracking-tight text-ink">
          Flow <span className="text-orange">·</span> {PERIOD_LABEL[period]}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            label={`Signups ${PERIOD_NOUN[period]}`}
            value={cur.signups}
            sub={`${PERIOD_WINDOW[period]} in the trend below`}
            current={cur.signups}
            prior={prev ? prev.signups : null}
            deltaLabel={PERIOD_PRIOR[period]}
            delay={40}
          />
          <Card
            label={`Conversions ${PERIOD_NOUN[period]}`}
            value={cur.conversions}
            sub="deposits verified"
            current={cur.conversions}
            prior={prev ? prev.conversions : null}
            deltaLabel={PERIOD_PRIOR[period]}
            delay={80}
          />
          <Card
            label={`Churn ${PERIOD_NOUN[period]}`}
            value={cur.churn}
            sub="members downgraded"
            current={cur.churn}
            prior={prev ? prev.churn : null}
            deltaLabel={PERIOD_PRIOR[period]}
            delay={120}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <TrendCard title="Signups" values={signupSeries} latest={String(cur.signups)} delay={160} />
          <TrendCard title="Conversions" values={conversionSeries} latest={String(cur.conversions)} delay={200} />
          <TrendCard title="Churn" values={churnSeries} latest={String(cur.churn)} delay={240} />
        </div>

        {/* Point-in-time metrics — live "as of now", not period-scoped */}
        <h2 className="mt-10 font-display text-lg font-bold tracking-tight text-ink">
          Right now <span className="text-orange">·</span> live
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card
            label="Active trials"
            value={live.trials_active}
            live
            current={live.trials_active}
            prior={yesterday?.trials_active}
            weekPrior={lastWeek?.trials_active}
            delta
            weekDelta
            delay={280}
          />
          <Card
            label="Expiring ≤48h"
            value={live.trials_expiring_48h}
            sub="active trials falling due"
            live
            delay={320}
          />
          <Card
            label="Verified members"
            value={live.members_verified}
            sub={`+ ${live.members_legacy} legacy (no deposit record)`}
            live
            current={live.members_verified}
            prior={yesterday?.members_verified}
            weekPrior={lastWeek?.members_verified}
            delta
            weekDelta
            delay={360}
          />
        </div>

        {/* Secondary live metrics */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            label="Signup → deposit"
            value={`${conv.ratePct}%`}
            sub={`${conv.verified} of ${conv.realSignups.toLocaleString()} real signups · all-time`}
            live
            delay={380}
          />
          <Card
            label="TV engagement"
            value={`${live.tv_engagement_pct}%`}
            sub="of all members (legacy included) with a TradingView handle"
            live
            delay={400}
          />
          <div
            className="rise rounded-2xl border border-line bg-card p-5 shadow-soft"
            style={{ animationDelay: "440ms" }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                Broker split (members)
              </p>
              <LiveTag />
            </div>
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

        {/* conversion-fix 1.5 — activation + the upgrade funnel, from app_events */}
        <h2 className="mt-10 font-display text-lg font-bold tracking-tight text-ink">
          Funnel <span className="text-orange">·</span> last {funnel.days} days
        </h2>
        <p className="mt-1 text-[12px] text-subtle">
          Tracked from 10 Sep 2026. Activation needs a 48-hour window to mature, so its
          cohort starts filling in two days after that; the upgrade steps count unique users.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            label="Activation"
            value={`${funnel.activationPct}%`}
            sub={`${funnel.activated} of ${funnel.cohort} signups · TradingView + Daily Analysis within 48h`}
            delay={440}
          />
          <div
            className="rise rounded-2xl border border-line bg-card p-5 shadow-soft lg:col-span-2"
            style={{ animationDelay: "460ms" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Upgrade funnel · unique users
            </p>
            <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {funnel.steps.map((step) => (
                <li key={step.key} className="rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                  <p className="font-display text-2xl font-bold leading-none text-ink">{step.users}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-subtle">{step.label}</p>
                  <p className="mt-1 text-[10.5px] text-faint">
                    {step.pctOfPrev == null ? "top of funnel" : `${step.pctOfPrev}% of previous`}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            label="TradingView ≤48h"
            value={funnel.tv48}
            sub={`of ${funnel.cohort} in the cohort · Daily Analysis ≤48h: ${funnel.da48}`}
            delay={480}
          />
          <Card
            label="Activated → deposit"
            value={`${funnel.activatedConvPct}%`}
            sub={`${funnel.activatedVerified} of ${funnel.activated} activated signups`}
            delay={500}
          />
          <Card
            label="Not activated → deposit"
            value={`${funnel.notActivatedConvPct}%`}
            sub={`${funnel.notActivatedVerified} of ${Math.max(0, funnel.cohort - funnel.activated)} others`}
            delay={520}
          />
        </div>

        {/* Point-in-time trends from snapshots */}
        <h2 className="mt-10 font-display text-lg font-bold tracking-tight text-ink">
          Trends <span className="text-orange">·</span> {PERIOD_WINDOW[period]}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <TrendCard
            title="Active trials"
            values={trialSeries}
            latest={String(live.trials_active)}
            note={snapNote}
            delay={480}
          />
          <TrendCard
            title="Verified members"
            values={verifiedSeries}
            latest={String(live.members_verified)}
            note="from snapshots · tracked from 10 Sep 2026"
            delay={520}
          />
          <TrendCard
            title="All members (incl. legacy)"
            values={memberSeries}
            latest={String(live.members_active)}
            note={snapNote}
            delay={560}
          />
        </div>

        <p className="mt-8 pb-8 text-[12px] text-faint">
          Snapshot date {fmtDay(live.date)} (SGT). Flow numbers are derived live from member
          records across the {PERIOD_WINDOW[period]}; the &ldquo;right now&rdquo; cards are live totals,
          and their trends come from the forward-only 09:00-SGT snapshots. Conversion counts
          verified deposits only: the {live.members_legacy} grandfathered legacy members have no
          deposit record, so they sit outside both sides of the rate.
        </p>
      </div>
    </main>
  );
}

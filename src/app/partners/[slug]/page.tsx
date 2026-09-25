import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { partnerDb } from "@/lib/partners/client";
import { resolvePartner } from "@/lib/partners/auth";
import {
  byLabel,
  byWeek,
  fmtMoney,
  fmtWeek,
  parseRange,
  parseRule,
  fetchFunnel,
  RANGE_DAYS,
  RULES,
  RULE_LABEL,
  totals,
  type PartnerRule,
} from "@/lib/partners/funnel";

// The partner dashboard (design 2026-09-25 §2.6). No login: the link carries
// a key, the key either matches the stored hash or this is a 404. Everything
// on the page is a count — fn_partner_funnel returns no email, no name, no
// broker and no rate, so there is nothing here to leak.
//
// Server component, rendered fresh on every request, and never indexed.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner report",
  robots: { index: false, follow: false, nocache: true },
};

type Search = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ---- presentation ---------------------------------------------------------

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12px] text-subtle">{sub}</p>}
    </div>
  );
}

// Inline-SVG sparkline, same shape as /stats: no charting dependency.
function Sparkline({ values }: { values: number[] }) {
  const W = 120;
  const H = 28;
  const pad = 3;
  if (values.length < 2) return <span className="text-[11px] text-faint">—</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (H - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-[120px]" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-orange)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Seg({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink shadow-soft"
          : "rounded-lg px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-accent-ink"
      }
    >
      {children}
    </a>
  );
}

// ---- page -----------------------------------------------------------------

export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const key = one(sp.key) ?? null;

  // One answer for a bad slug, an unknown partner, a deactivated one and a
  // wrong key: telling them apart would tell a stranger which slugs exist.
  const partner = await resolvePartner(partnerDb(), slug, key);
  if (!partner) notFound();

  const range = parseRange(sp);
  const rule = parseRule(one(sp.rule));

  // The documented CSV parameter is ?format=csv on this URL (§2.6). A page
  // cannot set a Content-Type, so it hands the same query to the sibling
  // route that can.
  const qs = (over: Record<string, string>) => {
    const q = new URLSearchParams({ key: key! });
    if (range.days) q.set("days", String(range.days));
    else {
      q.set("since", range.since.toISOString());
      q.set("until", range.until.toISOString());
    }
    q.set("rule", rule);
    for (const [k, v] of Object.entries(over)) q.set(k, v);
    return `?${q.toString()}`;
  };

  if (one(sp.format) === "csv") redirect(`/partners/${partner.slug}/export${qs({})}`);

  const rows = await fetchFunnel(partnerDb(), {
    slug: partner.slug,
    since: range.since,
    until: range.until,
    rule,
  });
  const t = totals(rows);
  const ads = byLabel(rows);
  const weeks = byWeek(rows);

  const base = `/partners/${partner.slug}`;
  const rangeHref = (days: number) => `${base}${qs({ days: String(days) })}`;
  const ruleHref = (r: PartnerRule) => `${base}${qs({ rule: r })}`;

  const template =
    `?cid=AGY-${partner.slug}-{{ad.name}}&geo=<MY|ID|IN|SG>` +
    `&utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}`;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">
            Market Makers <span className="text-orange">FX</span>
          </span>
          <span className="text-[13px] text-subtle">Partner report</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {partner.name} <span className="text-orange">·</span> funnel
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Signups grouped by the week they signed up, and by the ad that brought them.{" "}
          {fmtWeek(range.since.toISOString().slice(0, 10))} to{" "}
          {fmtWeek(range.until.toISOString().slice(0, 10))}.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-soft">
            {RANGE_DAYS.map((d) => (
              <Seg key={d} href={rangeHref(d)} active={range.days === d}>
                Last {d} days
              </Seg>
            ))}
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-soft">
            {RULES.map((r) => (
              <Seg key={r} href={ruleHref(r)} active={rule === r}>
                {RULE_LABEL[r]}
              </Seg>
            ))}
          </div>
          <a
            href={`${base}/export${qs({})}`}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink"
          >
            Download CSV
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Tile label="Signups" value={t.signups.toLocaleString()} />
          <Tile label="Activated" value={t.activated.toLocaleString()} sub="did something in the app" />
          <Tile label="Funded" value={t.funded.toLocaleString()} sub="verified deposits" />
          <Tile label="Deposits" value={fmtMoney(t.depositTotal)} sub="verified, cumulative" />
          <Tile label="Funded rate" value={`${t.fundedRate}%`} sub="of signups in this range" />
        </div>

        <p className="mt-3 text-[12px] text-subtle">
          Under first touch the same range reads {t.firstTouchSignups.toLocaleString()} signups and{" "}
          {t.firstTouchFunded.toLocaleString()} funded. Both numbers are shown so a difference
          between the two rules is visible rather than hidden.
        </p>

        <h2 className="mt-9 font-display text-lg font-bold tracking-tight text-ink">
          By ad <span className="text-orange">·</span> {ads.length} running
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card p-5 shadow-soft">
          {ads.length === 0 ? (
            <p className="text-[13px] text-subtle">No signups carried this tag in this range.</p>
          ) : (
            <table className="w-full min-w-[620px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Ad</th>
                  <th className="py-1.5 pr-3 font-semibold">Signups</th>
                  <th className="py-1.5 pr-3 font-semibold">Activated</th>
                  <th className="py-1.5 pr-3 font-semibold">Funded</th>
                  <th className="py-1.5 pr-3 font-semibold">Deposits</th>
                  <th className="py-1.5 font-semibold">Weekly signups</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((a) => (
                  <tr key={a.label} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium text-ink">{a.label}</td>
                    <td className="py-2 pr-3 text-ink">{a.signups}</td>
                    <td className="py-2 pr-3 text-ink">{a.activated}</td>
                    <td className="py-2 pr-3 font-semibold text-ink">{a.funded}</td>
                    <td className="py-2 pr-3 text-ink">{fmtMoney(a.depositTotal)}</td>
                    <td className="py-2">
                      <Sparkline values={a.weekly} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="mt-9 font-display text-lg font-bold tracking-tight text-ink">
          By week <span className="text-orange">·</span> signup cohort
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card p-5 shadow-soft">
          {weeks.length === 0 ? (
            <p className="text-[13px] text-subtle">Nothing yet in this range.</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Week of</th>
                  <th className="py-1.5 pr-3 font-semibold">Signups</th>
                  <th className="py-1.5 pr-3 font-semibold">Activated</th>
                  <th className="py-1.5 pr-3 font-semibold">Funded</th>
                  <th className="py-1.5 font-semibold">Deposits</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink">{fmtWeek(w.week)}</td>
                    <td className="py-2 pr-3 text-ink">{w.signups}</td>
                    <td className="py-2 pr-3 text-ink">{w.activated}</td>
                    <td className="py-2 pr-3 font-semibold text-ink">{w.funded}</td>
                    <td className="py-2 text-ink">{fmtMoney(w.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="mt-9 border-t border-line pt-5 pb-10 text-[12px] leading-relaxed text-faint">
          <p>
            Attribution: last paid touch within 7 days of the deposit. Counts are verified deposits
            only. A signup is counted in the week it signed up; activated means the person connected
            TradingView, completed Know Your Style, read a daily analysis or finished an onboarding
            step.
          </p>
          <p className="mt-3">
            Tag every ad with this URL parameter template, set once per campaign. Meta substitutes
            the tokens per ad, so the ad name you write is the label you read above.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg border border-line bg-card px-3 py-2 font-mono text-[11.5px] text-subtle">
            {template}
          </code>
        </footer>
      </div>
    </main>
  );
}

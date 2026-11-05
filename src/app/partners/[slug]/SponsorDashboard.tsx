import type { Partner } from "@/lib/partners/auth";
import { fmtMoney, fmtWeek } from "@/lib/partners/funnel";
import { byAd, byWeek, RANGE_PRESETS, STAGE_LABEL, totals, type RangePreset } from "@/lib/sponsors/funnel";
import type { SponsorData } from "@/lib/sponsors/load";
import { describeWindow, fmtDate } from "@/lib/sponsors/windows";
import { Seg, Tile } from "./ui";

// The sponsor's view of /partners/<slug> (design 2026-11-05 §4). A plain
// function of data the page has already loaded, so the page test can render it
// with renderToStaticMarkup. Everything personal is masked in SQL before it
// gets here; this file only lays it out.

const BROKER_NAME: Record<string, string> = { octa: "Octa", elev8: "Elev8", dupoin: "Dupoin", gtc: "GTC", weby: "Weby" };

export function brokerLabel(brokers: string[]): string {
  const names = brokers.map((b) => BROKER_NAME[b] ?? b);
  return names.length ? names.join(" / ") : "the broker";
}

const PRESET_LABEL: Record<RangePreset, string> = {
  all: "Whole deal",
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

const TH = "py-1.5 pr-3 font-semibold";
const TD = "py-2 pr-3 text-ink";
const BUTTON =
  "rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:border-orange/40 hover:text-accent-ink";

type Props = { partner: Partner; keyParam: string; data: SponsorData };

export function SponsorDashboard({ partner, keyParam, data }: Props) {
  const { windows, range, rows, clients } = data;
  const t = totals(rows);
  const weeks = byWeek(rows);
  const ads = byAd(rows);
  const broker = brokerLabel(partner.brokers);
  const base = `/partners/${partner.slug}`;

  const qs = (over: Record<string, string>) => {
    const q = new URLSearchParams({ key: keyParam, days: String(range.preset) });
    for (const [k, v] of Object.entries(over)) q.set(k, v);
    return `?${q.toString()}`;
  };

  const geo = windows.length ? windows.map((w) => w.country).join("|") : "MY";
  const template =
    `?cid=SPN-${partner.slug}-{{ad.name}}&geo=<${geo}>` +
    `&utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}`;
  const windowLine = windows.length
    ? windows.map(describeWindow).join("; ")
    : "No sponsorship window is on file yet, so this shows the last 90 days.";

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">
            Market Makers <span className="text-orange">FX</span>
          </span>
          <span className="text-[13px] text-subtle">Sponsor report</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {partner.name} <span className="text-orange">·</span> sponsorship
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          {windowLine} Showing {fmtDate(range.since.toISOString())} to {fmtDate(range.until.toISOString())}.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-soft">
            {RANGE_PRESETS.map((p) => (
              <Seg key={String(p)} href={`${base}${qs({ days: String(p), page: "1" })}`} active={range.preset === p}>
                {PRESET_LABEL[p]}
              </Seg>
            ))}
          </div>
          <a href={`${base}/export${qs({ table: "clients" })}`} className={BUTTON}>
            Download clients CSV
          </a>
          <a href={`${base}/export${qs({})}`} className={BUTTON}>
            Download funnel CSV
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Tile label="Signups" value={t.signups.toLocaleString()} sub="new accounts in your countries" />
          <Tile label="Directly traced" value={t.traced.toLocaleString()} sub="arrived through your tagged ads" />
          <Tile label="Activated" value={t.activated.toLocaleString()} sub="did something in the app" />
          <Tile label={`Clicked ${broker} link`} value={t.brokerClicked.toLocaleString()} sub="from the upgrade page" />
          <Tile label={`Funded with ${broker}`} value={t.funded.toLocaleString()} sub={`${t.fundedRate}% of signups`} />
          <Tile label="Deposits" value={fmtMoney(t.depositTotal)} sub="verified, cumulative" />
        </div>

        <h2 className="mt-9 font-display text-lg font-bold tracking-tight text-ink">
          By week <span className="text-orange">·</span> signup cohort
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card p-5 shadow-soft">
          {weeks.length === 0 ? (
            <p className="text-[13px] text-subtle">Nothing yet in this range.</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className={TH}>Week of</th>
                  <th className={TH}>Signups</th>
                  <th className={TH}>Traced</th>
                  <th className={TH}>Activated</th>
                  <th className={TH}>Upgrade page</th>
                  <th className={TH}>Broker link</th>
                  <th className={TH}>Submitted</th>
                  <th className={TH}>Funded</th>
                  <th className="py-1.5 font-semibold">Deposits</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week} className="border-t border-line">
                    <td className={TD}>{fmtWeek(w.week)}</td>
                    <td className={TD}>{w.signups}</td>
                    <td className={TD}>{w.traced}</td>
                    <td className={TD}>{w.activated}</td>
                    <td className={TD}>{w.upgradeViewed}</td>
                    <td className={TD}>{w.brokerClicked}</td>
                    <td className={TD}>{w.submitted}</td>
                    <td className="py-2 pr-3 font-semibold text-ink">{w.funded}</td>
                    <td className="py-2 text-ink">{fmtMoney(w.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="mt-9 font-display text-lg font-bold tracking-tight text-ink">
          Your tagged ads <span className="text-orange">·</span> {ads.length} seen
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card p-5 shadow-soft">
          {ads.length === 0 ? (
            <p className="text-[13px] text-subtle">
              No signup in this range carried your tag yet. Tag ads with the template at the foot of the page.
            </p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className={TH}>Ad</th>
                  <th className={TH}>Signups</th>
                  <th className={TH}>Activated</th>
                  <th className={TH}>Funded</th>
                  <th className="py-1.5 font-semibold">Deposits</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((a) => (
                  <tr key={a.label} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium text-ink">{a.label}</td>
                    <td className={TD}>{a.signups}</td>
                    <td className={TD}>{a.activated}</td>
                    <td className="py-2 pr-3 font-semibold text-ink">{a.funded}</td>
                    <td className="py-2 text-ink">{fmtMoney(a.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="mt-9 font-display text-lg font-bold tracking-tight text-ink">
          Clients <span className="text-orange">·</span> {clients.total.toLocaleString()} in this range
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card p-5 shadow-soft">
          {clients.rows.length === 0 ? (
            <p className="text-[13px] text-subtle">No signups in this range.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className={TH}>Signed up</th>
                  <th className={TH}>Country</th>
                  <th className={TH}>Client</th>
                  <th className={TH}>Stage</th>
                  <th className={TH}>Ad</th>
                  <th className={TH}>Account</th>
                  <th className="py-1.5 font-semibold">Deposits</th>
                </tr>
              </thead>
              <tbody>
                {clients.rows.map((c, i) => (
                  <tr key={`${c.signedUp}-${i}`} className="border-t border-line">
                    <td className={TD}>{fmtDate(c.signedUp)}</td>
                    <td className={TD}>{c.country}</td>
                    <td className="py-2 pr-3 font-medium text-ink">{c.display ?? "—"}</td>
                    <td className={TD}>{STAGE_LABEL[c.stage]}</td>
                    <td className={TD}>{c.adLabel ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-ink">{c.accountNumber ?? "—"}</td>
                    <td className="py-2 text-ink">{c.depositTotal === null ? "—" : fmtMoney(c.depositTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {clients.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[13px] text-subtle">
              <span>
                Page {clients.page} of {clients.pages}
              </span>
              <span className="inline-flex gap-1 rounded-xl border border-line bg-card p-1 shadow-soft">
                {clients.page > 1 && (
                  <Seg href={`${base}${qs({ page: String(clients.page - 1) })}`} active={false}>
                    Newer
                  </Seg>
                )}
                {clients.page < clients.pages && (
                  <Seg href={`${base}${qs({ page: String(clients.page + 1) })}`} active={false}>
                    Older
                  </Seg>
                )}
              </span>
            </div>
          )}
        </div>

        <footer className="mt-9 border-t border-line pt-5 pb-10 text-[12px] leading-relaxed text-faint">
          <p>
            Signups are every new account from your sponsored countries inside the deal window, whatever
            brought them. Directly traced are the ones whose first visit carried your ad tag. Activated
            means the person connected TradingView, completed Know Your Style, read a daily analysis or
            finished an onboarding step. Funded and deposits count verified deposits with {broker} only.
            Clients are shown by first name and initial; the trading account number appears once they have
            funded with {broker}.
          </p>
          <p className="mt-3">
            Tag every ad with this URL parameter template, set once per campaign. Meta substitutes the
            tokens per ad, so the ad name you write is the label you read above.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg border border-line bg-card px-3 py-2 font-mono text-[11.5px] text-subtle">
            {template}
          </code>
        </footer>
      </div>
    </main>
  );
}

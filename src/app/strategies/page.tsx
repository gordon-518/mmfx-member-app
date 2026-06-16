import Image from "next/image";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
import { MM_INDICATORS_DISCLAIMER } from "@/lib/content/disclaimer";

// Published MM TradingView strategy scripts. The .pine source is NEVER served
// here — these are just links to the public TradingView publications + a chart
// screenshot cover. Three slots are still in build.
interface Strategy {
  slug: string;
  name: string;
  type: string;
  signal: string;
  tvUrl: string;
  cover: string;
}

const STRATEGIES: Strategy[] = [
  {
    slug: "mm-ama-supertrend",
    name: "MM AMA SuperTrend",
    type: "Trend",
    signal: "An adaptive-MA SuperTrend — trend direction, flip levels and long/short triggers, backtested on gold.",
    tvUrl: "https://www.tradingview.com/script/vHt8dWZt-MM-AMA-SuperTrend/",
    cover: "/strategies/mm-ama-supertrend.jpg",
  },
  {
    slug: "mm-system-5m-entry",
    name: "MM System 5m Entry",
    type: "Entry",
    signal: "The 5-minute entry model in code — HTF bias, sell/buy zones and confirmation, the MM workflow automated.",
    tvUrl: "https://www.tradingview.com/script/gzyYtuwj-MM-System-5m-Entry/",
    cover: "/strategies/mm-system-5m-entry.jpg",
  },
];

const COMING_SOON = 3;

export default async function StrategiesPage() {
  const profile = await requireFull();

  return (
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">Tools · XAU/USD</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">Strategies</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            Backtestable TradingView strategy scripts — entries, exits and risk encoded so you can
            test them on your own charts. Two are live; more on the way.
          </p>
        </div>

        {/* Grid: live strategies + coming-soon slots */}
        <div className="rise mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGIES.map((s) => (
            <a
              key={s.slug}
              href={s.tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block cursor-pointer overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-ink">
                <Image
                  src={s.cover}
                  alt={`${s.name} backtest on TradingView`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[16px] font-bold tracking-tight text-ink">{s.name}</h3>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                    {s.type}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-subtle">{s.signal}</p>
                <p className="mt-3.5 text-[12px] font-semibold uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1.5 text-orange transition-colors group-hover:text-accent-ink">
                    View on TradingView <ExternalIcon width={13} height={13} />
                  </span>
                </p>
              </div>
            </a>
          ))}

          {Array.from({ length: COMING_SOON }, (_, i) => (
            <article
              key={`soon-${i}`}
              className="rounded-2xl border border-dashed border-line-strong bg-card/50 p-5"
            >
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-accent-soft/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Coming soon</span>
              </div>
              <h3 className="mt-4 font-display text-[16px] font-bold tracking-tight text-subtle">In build</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                Another backtestable setup — added to your member area soon.
              </p>
            </article>
          ))}
        </div>

        {/* Disclaimer */}
        <footer className="mt-14 border-t border-line pt-6">
          <p className="text-[12px] leading-relaxed text-faint">{MM_INDICATORS_DISCLAIMER}</p>
        </footer>
      </div>
    </AppShell>
  );
}

import Image from "next/image";
import Link from "next/link";
import { requireFull } from "@/lib/access";
import { MM_INDICATORS_DISCLAIMER } from "@/lib/content/disclaimer";
import { INDICATORS } from "./data";
import { setTradingViewUsername } from "./actions";

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  const profile = await requireFull();

  const { tv_error } = await searchParams;
  const tvError = typeof tv_error === "string" ? tv_error : null;
  const hasUsername = Boolean(profile.tradingview_username);

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Indicators
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-10 sm:px-10">
        {/* Header */}
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Tools · XAU/USD
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          MM Indicators
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Ten TradingView indicators, granted to your account. Submit your
          TradingView username below and we add you to all ten.
        </p>

        {/* TradingView access block */}
        <section className="mt-8 rounded-lg border border-pearl/10 bg-graphite/70 p-6">
          {hasUsername ? (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
                Access requested · pending
              </p>
              <p className="mt-2 text-sm leading-relaxed text-pearl">
                Access requested for{" "}
                <span className="font-mono text-orange">
                  {profile.tradingview_username}
                </span>{" "}
                — pending. Indicators are granted on TradingView; you&apos;ll be
                added shortly.
              </p>
              {/* Optional: let them correct the handle */}
              <form action={setTradingViewUsername} className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  name="tradingview_username"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="update username"
                  className="w-56 border border-pearl/20 bg-obsidian/60 px-3 py-2 font-mono text-sm text-pearl placeholder:text-muted/50 focus:border-orange focus:outline-none"
                />
                <button
                  type="submit"
                  className="border border-pearl/20 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-orange/60 hover:text-pearl"
                >
                  Update
                </button>
              </form>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
                Request access
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Enter your TradingView username to get access to all 10
                indicators. We grant access manually — you&apos;ll be added
                shortly.
              </p>
              <form action={setTradingViewUsername} className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  name="tradingview_username"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="your TradingView username"
                  className="w-72 border border-pearl/20 bg-obsidian/60 px-3 py-2.5 font-mono text-sm text-pearl placeholder:text-muted/50 focus:border-orange focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-orange px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
                >
                  Request access
                </button>
              </form>
            </div>
          )}
          {tvError && (
            <p role="alert" className="mt-3 font-mono text-xs text-orange">
              ✕ {tvError}
            </p>
          )}
        </section>

        {/* Indicator grid */}
        <p className="mb-4 mt-12 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          The Suite · 10
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATORS.map((ind) => {
            const inner = (
              <>
                <div className="relative flex aspect-video w-full items-center justify-center bg-obsidian">
                  {ind.noCover ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className="font-display text-lg font-bold tracking-tight text-pearl">
                        MM <span className="text-orange">FX</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                        {ind.type}
                      </span>
                    </div>
                  ) : (
                    <Image
                      src={`/indicators/${ind.slug}-cover.png`}
                      alt={`${ind.name} chart preview`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-base font-semibold text-pearl">
                      {ind.name}
                    </h3>
                    <span className="shrink-0 border border-pearl/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                      {ind.type}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
                    <span className="text-orange/70">▪</span> {ind.signal}
                  </p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em]">
                    {ind.tvUrl ? (
                      <span className="text-orange">View on TradingView ↗</span>
                    ) : (
                      <span className="text-muted/60">Publishing soon</span>
                    )}
                  </p>
                </div>
              </>
            );

            const cardClass =
              "block overflow-hidden rounded-lg border border-pearl/10 bg-graphite/70";

            return ind.tvUrl ? (
              <a
                key={ind.slug}
                href={ind.tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cardClass} transition-transform duration-150 hover:-translate-y-0.5 hover:border-orange/50`}
              >
                {inner}
              </a>
            ) : (
              <article key={ind.slug} className={cardClass}>
                {inner}
              </article>
            );
          })}
        </div>

        {/* Disclaimer */}
        <footer className="mt-14 border-t border-pearl/10 pt-6">
          <p className="font-mono text-[11px] leading-relaxed text-muted/80">
            {MM_INDICATORS_DISCLAIMER}
          </p>
        </footer>
      </div>
    </main>
  );
}

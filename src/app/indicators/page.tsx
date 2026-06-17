import Image from "next/image";
import { requireFull } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { ExternalIcon } from "@/components/icons";
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
    <AppShell email={profile.email} accountStatus={profile.account_status} tier="Full">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="rise">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
            Tools · XAU/USD
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
            Indicators
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-subtle">
            Ten TradingView indicators, granted to your account. Submit your
            TradingView username below and we add you to all ten.
          </p>
        </div>

        {/* TradingView access block */}
        <section className="rise mt-7 rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-7">
          {hasUsername ? (
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Access requested · pending
              </span>
              <p className="mt-3 text-[15px] leading-relaxed text-ink">
                Access requested for{" "}
                <span className="font-semibold text-accent-ink">
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
                  className="w-full sm:w-56 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15"
                />
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl border border-line-strong bg-card px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:border-orange/40 hover:text-accent-ink"
                >
                  Update
                </button>
              </form>
            </div>
          ) : (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
                Request access
              </p>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-subtle">
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
                  className="w-full sm:w-72 rounded-xl border border-line bg-paper px-3.5 py-3 text-[14px] text-ink placeholder:text-faint focus:border-orange/40 focus:outline-none focus:ring-2 focus:ring-orange/15"
                />
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
                >
                  Request access
                </button>
              </form>
            </div>
          )}
          {tvError && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-accent-ink">
              ✕ {tvError}
            </p>
          )}
        </section>

        {/* Indicator grid */}
        <p className="mb-4 mt-11 text-[12px] font-semibold uppercase tracking-wider text-faint">
          The Suite · 10
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATORS.map((ind) => {
            const inner = (
              <>
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-accent-soft">
                  {ind.noCover ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="font-display text-lg font-bold tracking-tight text-ink">
                        MM <span className="text-orange">FX</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
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
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[16px] font-bold tracking-tight text-ink">
                      {ind.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                      {ind.type}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-subtle">
                    {ind.signal}
                  </p>
                  <p className="mt-3.5 text-[12px] font-semibold uppercase tracking-wide">
                    {ind.tvUrl ? (
                      <span className="inline-flex items-center gap-1.5 text-orange transition-colors group-hover:text-accent-ink">
                        View on TradingView <ExternalIcon width={13} height={13} />
                      </span>
                    ) : (
                      <span className="text-faint">Publishing soon</span>
                    )}
                  </p>
                </div>
              </>
            );

            const cardClass =
              "block overflow-hidden rounded-2xl border border-line bg-card shadow-soft";

            return ind.tvUrl ? (
              <a
                key={ind.slug}
                href={ind.tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group ${cardClass} cursor-pointer transition-all hover:-translate-y-0.5 hover:border-orange/30 hover:shadow-soft-lg`}
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
        <footer className="mt-14 border-t border-line pt-6">
          <p className="text-[12px] leading-relaxed text-faint">
            {MM_INDICATORS_DISCLAIMER}
          </p>
        </footer>
      </div>
    </AppShell>
  );
}

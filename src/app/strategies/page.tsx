import Link from "next/link";
import { requireFull } from "@/lib/access";
import { MM_INDICATORS_DISCLAIMER } from "@/lib/content/disclaimer";

// Stub page — the 5 backtestable MM TV Strategy scripts aren't built yet.
// Placeholders only; no data, no capture form. Gated like every member page.
const PLACEHOLDERS = [1, 2, 3, 4, 5];

export default async function StrategiesPage() {
  await requireFull();

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
            Strategies
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
          Tools · Coming soon
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-pearl sm:text-4xl">
          MM TV Strategies
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Backtestable TradingView strategy scripts — entries, exits and risk
          encoded so you can test them on your own charts. They&apos;re in
          build; this is where they&apos;ll land.
        </p>

        {/* Placeholder grid */}
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDERS.map((n) => (
            <article
              key={n}
              className="rounded-lg border border-dashed border-pearl/15 bg-graphite/40 p-5"
            >
              <div className="flex aspect-video w-full items-center justify-center rounded border border-pearl/10 bg-obsidian/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted/60">
                  ▪ Coming soon
                </span>
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-muted">
                Strategy {n}
              </h3>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted/70">
                In build — added to your member area soon.
              </p>
            </article>
          ))}
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

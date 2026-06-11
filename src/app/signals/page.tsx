import Link from "next/link";
import { requireFull } from "@/lib/access";

const TELEGRAM_URL = "https://t.me/+y_Pry2NERes5MDg9";

export default async function SignalsPage() {
  // Gate: Limited users redirect to /upgrade, signed-out to /login.
  await requireFull();

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-pearl/10 px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-pearl">
            MARKET MAKERS <span className="text-orange">FX</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:inline">
            Signals
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-orange"
        >
          ← Desk
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-start px-6 py-16 sm:px-10 sm:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Live · XAU/USD
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-pearl sm:text-5xl">
          The signals desk
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          A few high-conviction Gold calls a day — entry, stop, and target,
          written down before the click. No filler, no noise. When there&apos;s
          nothing worth taking, we say so.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Calls post to the members&apos; Telegram channel as they&apos;re
          taken. Turn notifications on so you don&apos;t miss the window.
        </p>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-9 inline-flex items-center gap-2 rounded-lg bg-orange px-7 py-4 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
        >
          Open the signals channel ↗
        </a>

        <p className="mt-12 border-t border-pearl/10 pt-6 font-mono text-[11px] leading-relaxed text-muted/80">
          Trading involves risk, including the possible loss of capital. No
          returns are guaranteed.
        </p>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

// ---------------------------------------------------------------------------
// PLACEHOLDERS — Gordon swaps these in before launch. One broker for now;
// geo-based routing comes later.
const BROKER_SIGNUP_URL = "#BROKER_SIGNUP_URL"; // TODO: partner signup link
const BROKER_NAME = "[Broker]"; // TODO: e.g. "Octa"
// ---------------------------------------------------------------------------

// Copy on this page is APPROVED VERBATIM (day5 brief). Do not rewrite, soften,
// or add profit/return language. The risk footer stays.

const LOCKED_ITEMS = [
  "Your TradingView indicators",
  "The backtestable strategies",
  "The MM System, Decision Tree, If-Then, and Cheat Sheet",
  "The full video curriculum",
  "Two live classes a week",
  "The daily signals",
  "Know Your Style and the Fundamental Analysis desk",
];

export default async function UpgradePage() {
  const access = await getAccess();
  if (!access.signedIn) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="session-grid absolute inset-0" />
        <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-orange/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange/40 to-transparent" />
      </div>

      <article className="relative z-10 mx-auto max-w-2xl px-6 py-16 sm:py-20">
        {/* Headline */}
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-orange/80">
          Market Makers FX
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-pearl sm:text-5xl">
          Your 14 days are up. Your desk is still set.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          For two weeks you traded the MM System with everything unlocked. As
          of today the tools are locked — not gone. Here&apos;s what just went
          quiet:
        </p>

        {/* What's locked — the manifest */}
        <ul className="mt-8 border border-pearl/10 bg-graphite/70 p-6 font-mono text-sm">
          {LOCKED_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-baseline gap-3 border-b border-pearl/5 py-2.5 last:border-b-0"
            >
              <span aria-hidden className="text-orange/70">
                ▪
              </span>
              <span className="text-pearl/90">{item}</span>
            </li>
          ))}
        </ul>

        {/* The reframe */}
        <div className="mt-10">
          <p className="font-display text-2xl font-semibold leading-snug text-pearl">
            Keeping all of it isn&apos;t a $500 purchase. It&apos;s{" "}
            <span className="text-orange">$500 that stays yours.</span>
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted">
            You fund your own trading account with $500 at your broker. That
            capital sits in <em className="text-pearl">your</em> account, under{" "}
            <em className="text-pearl">your</em> name — you trade it, you
            withdraw it. Nothing is paid to us. Fund your account, and the desk
            reopens.
          </p>
        </div>

        {/* The mechanism — founder voice */}
        <blockquote className="mt-10 border-l-2 border-orange/60 pl-5">
          <p className="text-base leading-relaxed text-pearl/90">
            I don&apos;t charge traders for education, and I never will. When
            you fund your own account, the broker funds your seat — that&apos;s
            how the desk stays free. Your money goes into your trading, not
            into a subscription.
          </p>
        </blockquote>

        {/* Reassurance */}
        <p className="mt-10 border-y border-pearl/10 py-4 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted">
          No subscription. No card on file. No fee. A deposit you own, and a
          desk that stays open.
        </p>

        {/* CTA */}
        <div className="mt-10 text-center">
          <a
            href={BROKER_SIGNUP_URL}
            className="inline-flex items-center gap-2 rounded-lg bg-orange px-8 py-4 font-display text-sm font-semibold uppercase tracking-wider text-black transition-transform duration-150 hover:-translate-y-px"
          >
            Fund your account — restore full access <span aria-hidden>→</span>
          </a>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Deposit $500 with {BROKER_NAME}, send your confirmation, and your
            access is switched back on.
          </p>
        </div>

        {/* Compliance footer — verbatim, do not remove */}
        <footer className="mt-16 border-t border-pearl/10 pt-6 text-center">
          <p className="font-mono text-[11px] leading-relaxed text-muted/80">
            Trading involves risk, including the possible loss of capital. No
            returns are guaranteed.
          </p>
        </footer>
      </article>
    </main>
  );
}

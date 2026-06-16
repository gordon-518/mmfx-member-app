import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { Wordmark } from "@/components/AppShell";

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
    <main className="min-h-screen bg-paper">
      {/* Minimal top bar — focused conversion page, no member sidebar. */}
      <header className="flex items-center justify-between border-b border-line bg-card/60 px-5 py-4 sm:px-8">
        <Link href="/dashboard">
          <Wordmark />
        </Link>
        <Link
          href="/dashboard"
          className="text-[13px] font-semibold text-subtle transition-colors hover:text-ink"
        >
          ← Dashboard
        </Link>
      </header>

      <article className="rise mx-auto max-w-2xl px-6 py-14 sm:py-20">
        {/* Headline */}
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">
          Market Makers FX
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          Your 14 days are up. Your desk is still set.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-subtle">
          For two weeks you traded the MM System with everything unlocked. As
          of today the tools are locked — not gone. Here&apos;s what just went
          quiet:
        </p>

        {/* What's locked — the manifest */}
        <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
          {LOCKED_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 border-b border-line px-6 py-3 last:border-b-0"
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
              <span className="text-[15px] text-ink">{item}</span>
            </li>
          ))}
        </ul>

        {/* The reframe */}
        <div className="mt-10">
          <p className="font-display text-2xl font-bold leading-snug tracking-tight text-ink">
            Keeping all of it isn&apos;t a $500 purchase. It&apos;s{" "}
            <span className="text-orange">$500 that stays yours.</span>
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-subtle">
            You fund your own trading account with $500 at your broker. That
            capital sits in <em className="font-medium not-italic text-ink">your</em> account, under{" "}
            <em className="font-medium not-italic text-ink">your</em> name — you trade it, you
            withdraw it. Nothing is paid to us. Fund your account, and the desk
            reopens.
          </p>
        </div>

        {/* The mechanism — founder voice */}
        <blockquote className="mt-10 rounded-2xl border border-line bg-accent-soft/40 p-6">
          <p className="text-[16px] leading-relaxed text-ink">
            I don&apos;t charge traders for education, and I never will. When
            you fund your own account, the broker funds your seat — that&apos;s
            how the desk stays free. Your money goes into your trading, not
            into a subscription.
          </p>
        </blockquote>

        {/* Reassurance */}
        <p className="mt-10 border-y border-line py-4 text-center text-[12px] font-semibold uppercase tracking-wider text-subtle">
          No subscription. No card on file. No fee. A deposit you own, and a
          desk that stays open.
        </p>

        {/* CTA */}
        <div className="mt-10 text-center">
          <a
            href={BROKER_SIGNUP_URL}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-8 py-4 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-[#f24e12] hover:shadow-soft-lg"
          >
            Fund your account — restore full access <span aria-hidden>→</span>
          </a>
          <p className="mt-4 text-[15px] leading-relaxed text-subtle">
            Deposit $500 with {BROKER_NAME}, send your confirmation, and your
            access is switched back on.
          </p>
        </div>

        {/* Compliance footer — verbatim, do not remove */}
        <footer className="mt-16 border-t border-line pt-6 text-center">
          <p className="text-[12px] leading-relaxed text-faint">
            Trading involves risk, including the possible loss of capital. No
            returns are guaranteed.
          </p>
        </footer>
      </article>
    </main>
  );
}

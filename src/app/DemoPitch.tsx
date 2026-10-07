import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/AppShell";

// The partner-facing front door of a demo tenant. Adapted from
// mib-pack/source-markdown/IB-ONE-PAGER.md: what an IB's traders get, what runs
// behind it, what the IB brings. Rendered at "/" only when BRAND.demo is set;
// production keeps its redirect to the desk.

const TRADER_GETS = [
  {
    title: "A professional indicator suite",
    body: "Ten custom TradingView indicators and two backtestable strategies, delivered to the trader's TradingView account automatically the moment they enter their username. No codes to send, no tickets to answer.",
  },
  {
    title: "An AI trading assistant",
    body: "Connects read-only to their live MT4/MT5 account, imports every trade, and shows them the habits costing them money in dollars, a discipline score, and a coach that reviews their trading against goals they set. It cannot trade and never stores a password.",
  },
  {
    title: "A research desk",
    body: "An interactive bot that answers what is driving gold right now and emails them a written macro thesis as a PDF.",
  },
  {
    title: "A trader profiling quiz",
    body: "Profiles the trader's archetype and emails the result. Doubles as a lead magnet at the top of your funnel.",
  },
  {
    title: "Calendar and filtered news",
    body: "High and medium impact releases, and sentiment-tagged headlines across nineteen instruments.",
  },
  {
    title: "Your own content, if you have it",
    body: "Upload your course, analysis, signals and class schedule and it appears on your desk under your brand. If you have none, the tools stand on their own.",
  },
];

const BEHIND = [
  ["Verified signup and a 14-day full-access trial", "No card required, then an upgrade path routed correctly for the trader's country."],
  ["Lifecycle email that segments itself", "Trial, lapsed and funded traders get different sequences without anyone maintaining a list."],
  ["Analytics that show what converts", "A growth dashboard with a daily snapshot across the whole funnel."],
  ["Fraud protection", "Signup fingerprinting and trial-farm detection, so your numbers mean something."],
] as const;

export function DemoPitch({ tourHref }: { tourHref: string }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[14px] font-medium text-subtle hover:text-ink sm:block">
            Back office
          </Link>
          <Link
            href={tourHref}
            className="rounded-xl bg-orange px-4 py-2.5 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-hover"
          >
            Tour the desk
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-orange">For introducing brokers</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Your own trading desk. Built, branded and run for you.
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-subtle">
          You have an audience and a referral link. What you don&rsquo;t have is a product, so your
          traders open an account, trade for a few weeks, and drift. Quiet accounts pay nobody.
          {" "}{BRAND.name} is a complete desk under your brand, on your domain, that gives them a
          reason to log in every day.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={tourHref}
            className="rounded-xl bg-orange px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-orange-hover hover:shadow-soft-lg"
          >
            Tour the demo desk →
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-line-strong bg-card px-6 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-paper"
          >
            See the back office
          </Link>
        </div>
        <p className="mt-5 text-[13px] text-faint">
          Everything on this demo is live software. The name, colours and logo are placeholders;
          yours replace them in minutes.
        </p>
      </section>

      <section className="border-t border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">What your traders get</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TRADER_GETS.map((c) => (
              <div key={c.title} className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
                <h3 className="font-display text-[17px] font-semibold">{c.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-subtle">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">What runs behind the scenes</h2>
          <ul className="mt-6 space-y-4">
            {BEHIND.map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-orange" aria-hidden />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-[14.5px] text-subtle">{b}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14.5px] text-subtle">
            Optionally, we run your marketing too: landing pages, tracking and paid campaigns built and managed by our team.
          </p>
        </div>
        <div className="rounded-xl2 border border-line bg-card p-8 shadow-soft">
          <h2 className="font-display text-2xl font-bold tracking-tight">What you bring</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-subtle">
            Your audience. Your brand. Your market and your language. First-line contact with your own traders.
            That&rsquo;s it. We build and run everything else.
          </p>
          <h3 className="mt-8 font-display text-[17px] font-semibold">Why this works</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-subtle">
            A trader with a referral link has no reason to log in tomorrow. A trader with a desk, with their
            performance in front of them, their leaks named, their charts equipped and a coach reviewing
            their decisions, has a reason to log in every day. Traders who stay engaged stay funded.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-subtle">
            We are paid on volume, the same way you are. Our incentives and yours point in the same direction.
          </p>
          <Link
            href={tourHref}
            className="mt-8 inline-flex rounded-xl bg-orange px-5 py-3 text-[14px] font-semibold text-white shadow-soft transition-colors hover:bg-orange-hover"
          >
            Tour the demo desk →
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 text-[12.5px] leading-relaxed text-faint">
          Trading carries risk of loss. Nothing here is financial advice, and no outcome is promised or implied.
          The platform provides education, analysis and tools only. Outcomes depend entirely on the trader&rsquo;s own decisions.
        </div>
      </footer>
    </div>
  );
}
